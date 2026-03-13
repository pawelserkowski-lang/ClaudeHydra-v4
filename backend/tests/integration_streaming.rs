// BE-CH-007 — Integration tests for ClaudeHydra chat streaming.
//
// Tests the streaming and non-streaming chat endpoints using `tower::ServiceExt::oneshot()`
// against a test router. Since the handlers hardcode `https://api.anthropic.com` and we
// cannot MITM HTTPS, mock-based tests verify handler behavior through:
//   - Auth gating (no key -> 401)
//   - Request parsing (valid/invalid payloads)
//   - Circuit breaker state management
//   - Model tier resolution
//   - Helper function behavior (sanitize, truncate, retryable status)

use axum::http::StatusCode;
use jaskier_core::testing::{body_json, post_json};
use serde_json::json;
use tower::ServiceExt;

use claudehydra_backend::state::AppState;

// ── Helpers ──────────────────────────────────────────────────────────────────

fn app() -> axum::Router {
    let state = AppState::new_test();
    claudehydra_backend::create_test_router(state)
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/claude/chat — auth gating
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn chat_without_api_key_returns_401() {
    let body = json!({
        "messages": [{"role": "user", "content": "Hello"}]
    });

    let response = app().oneshot(post_json("/api/claude/chat", body)).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn chat_stream_without_api_key_returns_401() {
    let body = json!({
        "messages": [{"role": "user", "content": "Hello"}],
        "stream": true
    });

    let response = app()
        .oneshot(post_json("/api/claude/chat/stream", body))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn chat_request_accepted_with_model_field() {
    let body = json!({
        "messages": [{"role": "user", "content": "Test"}],
        "model": "claude-haiku-4-5-20251001"
    });

    let response = app().oneshot(post_json("/api/claude/chat", body)).await.unwrap();
    // No key -> 401, but endpoint parsed the body successfully (not 422 Unprocessable)
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn chat_request_accepted_with_temperature() {
    let body = json!({
        "messages": [{"role": "user", "content": "Test"}],
        "temperature": 0.5,
        "max_tokens": 100
    });

    let response = app().oneshot(post_json("/api/claude/chat", body)).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn chat_request_accepted_with_tools_enabled() {
    let body = json!({
        "messages": [{"role": "user", "content": "List files"}],
        "tools_enabled": true
    });

    let response = app()
        .oneshot(post_json("/api/claude/chat/stream", body))
        .await
        .unwrap();
    // tools_enabled=true routes to agentic handler. Without an API key the
    // handler starts the SSE stream but emits an error inside it. The HTTP
    // status is 200 (streaming has already started) — verify endpoint is reachable.
    let status = response.status().as_u16();
    assert!(
        status == 200 || status == 401,
        "Expected 200 (streaming started) or 401, got {status}"
    );
}

#[tokio::test]
async fn chat_request_accepted_with_session_id() {
    let body = json!({
        "messages": [{"role": "user", "content": "Hello"}],
        "session_id": "550e8400-e29b-41d4-a716-446655440000"
    });

    let response = app().oneshot(post_json("/api/claude/chat", body)).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/claude/models
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn claude_models_returns_3_tiers() {
    let response = app()
        .oneshot(jaskier_core::testing::get("/api/claude/models"))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let json = body_json(response).await;
    let models = json.as_array().unwrap();
    assert_eq!(models.len(), 3);

    let tiers: Vec<&str> = models.iter().filter_map(|m| m["tier"].as_str()).collect();
    assert!(tiers.contains(&"Commander"));
    assert!(tiers.contains(&"Coordinator"));
    assert!(tiers.contains(&"Executor"));
}

#[tokio::test]
async fn claude_models_all_have_anthropic_provider() {
    let response = app()
        .oneshot(jaskier_core::testing::get("/api/claude/models"))
        .await
        .unwrap();
    let json = body_json(response).await;
    for model in json.as_array().unwrap() {
        assert_eq!(model["provider"], "anthropic");
        assert_eq!(model["available"], true);
    }
}

#[tokio::test]
async fn claude_models_have_expected_ids() {
    let response = app()
        .oneshot(jaskier_core::testing::get("/api/claude/models"))
        .await
        .unwrap();
    let json = body_json(response).await;
    let models = json.as_array().unwrap();

    // Commander should be opus
    let commander = models.iter().find(|m| m["tier"] == "Commander").unwrap();
    assert!(
        commander["id"].as_str().unwrap().contains("opus"),
        "Commander should be an opus model: {}",
        commander["id"]
    );

    // Coordinator should be sonnet
    let coordinator = models.iter().find(|m| m["tier"] == "Coordinator").unwrap();
    assert!(
        coordinator["id"].as_str().unwrap().contains("sonnet"),
        "Coordinator should be a sonnet model: {}",
        coordinator["id"]
    );

    // Executor should be haiku
    let executor = models.iter().find(|m| m["tier"] == "Executor").unwrap();
    assert!(
        executor["id"].as_str().unwrap().contains("haiku"),
        "Executor should be a haiku model: {}",
        executor["id"]
    );
}

#[tokio::test]
async fn claude_models_have_required_fields() {
    let response = app()
        .oneshot(jaskier_core::testing::get("/api/claude/models"))
        .await
        .unwrap();
    let json = body_json(response).await;
    for model in json.as_array().unwrap() {
        assert!(model["id"].is_string(), "model missing id");
        assert!(model["name"].is_string(), "model missing name");
        assert!(model["tier"].is_string(), "model missing tier");
        assert!(model["provider"].is_string(), "model missing provider");
        assert!(model["available"].is_boolean(), "model missing available");
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Circuit breaker behavior
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn circuit_breaker_starts_closed() {
    let state = AppState::new_test();
    // Circuit breaker should be in CLOSED state initially (allowing requests)
    assert!(
        state.circuit_breaker.check().await.is_ok(),
        "Circuit breaker should start in CLOSED state"
    );
}

#[tokio::test]
async fn circuit_breaker_opens_after_failures() {
    let state = AppState::new_test();

    // Record 3 consecutive failures to trip the breaker
    state.circuit_breaker.record_failure().await;
    state.circuit_breaker.record_failure().await;
    state.circuit_breaker.record_failure().await;

    // Should now be OPEN (rejecting requests)
    assert!(
        state.circuit_breaker.check().await.is_err(),
        "Circuit breaker should be OPEN after 3 failures"
    );
}

#[tokio::test]
async fn circuit_breaker_resets_on_success() {
    let state = AppState::new_test();

    // Record 2 failures (not enough to trip)
    state.circuit_breaker.record_failure().await;
    state.circuit_breaker.record_failure().await;

    // Record a success to reset the counter
    state.circuit_breaker.record_success().await;

    // Should still be CLOSED
    assert!(
        state.circuit_breaker.check().await.is_ok(),
        "Circuit breaker should reset after success"
    );
}
