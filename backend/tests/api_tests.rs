use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::Value;
use tower::ServiceExt;

use claudehydra_backend::state::AppState;

/// Helper: build a fresh app router with a clean AppState for each test.
fn app() -> axum::Router {
    let state = Arc::new(Mutex::new(AppState::new()));
    claudehydra_backend::create_router(state)
}

/// Helper: collect a response body into a serde_json::Value.
async fn body_json(response: axum::response::Response) -> Value {
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/health
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn health_returns_200() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn health_has_correct_fields() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let json = body_json(response).await;

    assert_eq!(json["status"], "ok");
    assert_eq!(json["version"], "4.0.0");
    assert_eq!(json["app"], "ClaudeHydra");
    assert!(json["uptime_seconds"].is_u64());
    assert!(json["providers"].is_array());
    // No ollama_connected field anymore
    assert!(json.get("ollama_connected").is_none());
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/agents
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn agents_returns_200() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/agents")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn agents_returns_12_agents() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/agents")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let json = body_json(response).await;
    let agents = json.as_array().unwrap();
    assert_eq!(agents.len(), 12);
}

#[tokio::test]
async fn agents_have_required_fields() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/agents")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let json = body_json(response).await;
    let agents = json.as_array().unwrap();

    for agent in agents {
        assert!(agent["id"].is_string(), "agent missing id");
        assert!(agent["name"].is_string(), "agent missing name");
        assert!(agent["role"].is_string(), "agent missing role");
        assert!(agent["tier"].is_string(), "agent missing tier");
        assert!(agent["status"].is_string(), "agent missing status");
        assert!(agent["model"].is_string(), "agent missing model");
    }
}

#[tokio::test]
async fn agents_have_correct_model_per_tier() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/agents")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let json = body_json(response).await;
    let agents = json.as_array().unwrap();

    for agent in agents {
        let tier = agent["tier"].as_str().unwrap();
        let model = agent["model"].as_str().unwrap();
        match tier {
            "Commander" => assert_eq!(model, "claude-opus-4-6"),
            "Coordinator" => assert_eq!(model, "claude-sonnet-4-5-20250929"),
            "Executor" => assert_eq!(model, "claude-haiku-4-5-20251001"),
            _ => panic!("Unknown tier: {}", tier),
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/claude/models
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn claude_models_returns_3() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/claude/models")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let json = body_json(response).await;
    let models = json.as_array().unwrap();
    assert_eq!(models.len(), 3);

    for model in models {
        assert!(model["id"].is_string());
        assert!(model["name"].is_string());
        assert!(model["tier"].is_string());
        assert_eq!(model["provider"], "anthropic");
        assert_eq!(model["available"], true);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/settings
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn get_settings_returns_200() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/settings")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn get_settings_default_values() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/settings")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let json = body_json(response).await;
    assert_eq!(json["theme"], "dark");
    assert_eq!(json["language"], "en");
    assert_eq!(json["default_model"], "claude-sonnet-4-5-20250929");
    assert_eq!(json["auto_start"], false);
    // No ollama_host field anymore
    assert!(json.get("ollama_host").is_none());
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/settings
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn update_settings_returns_200() {
    let body = serde_json::json!({
        "theme": "light",
        "language": "pl",
        "default_model": "claude-opus-4-6",
        "auto_start": true
    });

    let response = app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/settings")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let json = body_json(response).await;
    assert_eq!(json["theme"], "light");
    assert_eq!(json["language"], "pl");
    assert_eq!(json["default_model"], "claude-opus-4-6");
    assert_eq!(json["auto_start"], true);
}

#[tokio::test]
async fn update_settings_persists() {
    let state = Arc::new(Mutex::new(AppState::new()));
    let router = claudehydra_backend::create_router(state.clone());

    let body = serde_json::json!({
        "theme": "light",
        "language": "de",
        "default_model": "claude-haiku-4-5-20251001",
        "auto_start": true
    });

    let _response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/settings")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let st = state.lock().unwrap();
    assert_eq!(st.settings.language, "de");
    assert_eq!(st.settings.default_model, "claude-haiku-4-5-20251001");
    assert!(st.settings.auto_start);
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/sessions  (empty list)
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn sessions_returns_200_empty() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/sessions")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let json = body_json(response).await;
    let sessions = json.as_array().unwrap();
    assert_eq!(sessions.len(), 0);
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/sessions  (create session)
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn create_session_returns_201() {
    let body = serde_json::json!({
        "title": "Test Session"
    });

    let response = app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/sessions")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);

    let json = body_json(response).await;
    assert_eq!(json["title"], "Test Session");
    assert!(json["id"].is_string());
    assert!(json["created_at"].is_string());
    assert!(json["messages"].is_array());
    assert_eq!(json["messages"].as_array().unwrap().len(), 0);
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/sessions/:id  (retrieve created session)
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn get_session_by_id() {
    let state = Arc::new(Mutex::new(AppState::new()));
    let router = claudehydra_backend::create_router(state.clone());

    // Create a session
    let create_body = serde_json::json!({ "title": "My Session" });

    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/sessions")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&create_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    let created = body_json(response).await;
    let session_id = created["id"].as_str().unwrap();

    // Retrieve it by ID
    let response = router
        .oneshot(
            Request::builder()
                .uri(format!("/api/sessions/{}", session_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let json = body_json(response).await;
    assert_eq!(json["id"].as_str().unwrap(), session_id);
    assert_eq!(json["title"], "My Session");
}

#[tokio::test]
async fn get_session_not_found_returns_404() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/sessions/nonexistent-id-12345")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /api/sessions/:id
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn delete_session_returns_200() {
    let state = Arc::new(Mutex::new(AppState::new()));
    let router = claudehydra_backend::create_router(state.clone());

    // Create a session
    let create_body = serde_json::json!({ "title": "To Delete" });

    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/sessions")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&create_body).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    let created = body_json(response).await;
    let session_id = created["id"].as_str().unwrap();

    // Delete it
    let response = router
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/sessions/{}", session_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let json = body_json(response).await;
    assert_eq!(json["status"], "deleted");
    assert_eq!(json["id"].as_str().unwrap(), session_id);

    // Verify it's gone
    let response = router
        .oneshot(
            Request::builder()
                .uri(format!("/api/sessions/{}", session_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn delete_nonexistent_session_returns_404() {
    let response = app()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/sessions/nonexistent-id-12345")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

// ═══════════════════════════════════════════════════════════════════════════
//  404 for unknown routes
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn unknown_route_returns_404() {
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/api/nonexistent")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
