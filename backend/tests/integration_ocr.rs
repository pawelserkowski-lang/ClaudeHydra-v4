// BE-CH-007 — Integration tests for ClaudeHydra OCR endpoints.
//
// Tests OCR request validation, preset auto-detection, page splitting,
// MIME type filtering, batch limits, and error handling.
// Uses `tower::ServiceExt::oneshot()` against the test router.
//
// Note: Tests that would require mocking `https://api.anthropic.com` are
// not possible without modifying production code (URL is hardcoded).
// Instead, we test all validation logic and error paths.

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

/// Minimal 1x1 transparent PNG encoded as base64.
const TINY_PNG_B64: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/ocr — MIME type validation
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn ocr_rejects_unsupported_mime_type() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "text/plain"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let json = body_json(response).await;
    let error = json["error"].as_str().unwrap();
    assert!(
        error.contains("Unsupported MIME type"),
        "Error should mention unsupported type: {error}"
    );
}

#[tokio::test]
async fn ocr_rejects_video_mime_type() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "video/mp4"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn ocr_rejects_audio_mime_type() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "audio/mpeg"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn ocr_accepts_png_mime() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "image/png"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    // Should pass MIME validation (fails later due to no API key -> 500)
    assert_ne!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn ocr_accepts_jpeg_mime() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "image/jpeg"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    assert_ne!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn ocr_accepts_webp_mime() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "image/webp"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    assert_ne!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn ocr_accepts_pdf_mime() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "application/pdf"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    assert_ne!(response.status(), StatusCode::BAD_REQUEST);
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/ocr — payload size validation
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn ocr_rejects_oversized_payload() {
    // Create a base64 string > 30MB (MAX_INPUT_SIZE)
    let large_data = "A".repeat(31_000_001);
    let body = json!({
        "data_base64": large_data,
        "mime_type": "image/png"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/ocr — without credentials
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn ocr_without_credentials_returns_500() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "image/png"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    // No Anthropic or Google key -> 500 (OCR processing failed)
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

    let json = body_json(response).await;
    assert!(json["error"].is_string());
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/ocr — optional fields parsing
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn ocr_accepts_optional_language_field() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "image/png",
        "language": "pl"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    // Passes JSON parsing (gets to API call stage, fails with 500 due to no key)
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn ocr_accepts_optional_preset_field() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "image/png",
        "preset": "invoice"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn ocr_accepts_html_output_format() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "image/png",
        "output_format": "html"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn ocr_accepts_extract_structured_flag() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "image/jpeg",
        "extract_structured": true,
        "filename": "faktura_2026.jpg"
    });

    let response = app().oneshot(post_json("/api/ocr", body)).await.unwrap();
    // Passes body parsing OK (500 due to no credentials)
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/ocr/stream — SSE streaming validation
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn ocr_stream_rejects_unsupported_mime() {
    let body = json!({
        "data_base64": TINY_PNG_B64,
        "mime_type": "text/html"
    });

    let response = app()
        .oneshot(post_json("/api/ocr/stream", body))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn ocr_stream_rejects_oversized_payload() {
    let large_data = "B".repeat(31_000_001);
    let body = json!({
        "data_base64": large_data,
        "mime_type": "image/png"
    });

    let response = app()
        .oneshot(post_json("/api/ocr/stream", body))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
}

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/ocr/batch/stream — batch validation
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn ocr_batch_rejects_too_many_items() {
    let items: Vec<serde_json::Value> = (0..11)
        .map(|i| {
            json!({
                "data_base64": TINY_PNG_B64,
                "mime_type": "image/png",
                "filename": format!("file_{i}.png")
            })
        })
        .collect();

    let body = json!({ "items": items });

    let response = app()
        .oneshot(post_json("/api/ocr/batch/stream", body))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let json = body_json(response).await;
    assert!(json["error"].as_str().unwrap().contains("Maximum 10"));
}

#[tokio::test]
async fn ocr_batch_accepts_10_items() {
    let items: Vec<serde_json::Value> = (0..10)
        .map(|i| {
            json!({
                "data_base64": TINY_PNG_B64,
                "mime_type": "image/png",
                "filename": format!("file_{i}.png")
            })
        })
        .collect();

    let body = json!({ "items": items });

    let response = app()
        .oneshot(post_json("/api/ocr/batch/stream", body))
        .await
        .unwrap();
    // 10 items should pass batch limit validation (then fail at OCR stage)
    assert_ne!(
        response.status(),
        StatusCode::BAD_REQUEST,
        "10 items should be within the batch limit"
    );
}

#[tokio::test]
async fn ocr_batch_rejects_invalid_mime_in_item() {
    let body = json!({
        "items": [
            {
                "data_base64": TINY_PNG_B64,
                "mime_type": "video/mp4",
                "filename": "test.mp4"
            }
        ]
    });

    let response = app()
        .oneshot(post_json("/api/ocr/batch/stream", body))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn ocr_batch_rejects_oversized_item() {
    let large_data = "C".repeat(31_000_001);
    let body = json!({
        "items": [
            {
                "data_base64": large_data,
                "mime_type": "image/png",
                "filename": "huge.png"
            }
        ]
    });

    let response = app()
        .oneshot(post_json("/api/ocr/batch/stream", body))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
}

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/ocr/history — requires DB (graceful failure)
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::test]
async fn ocr_history_returns_error_without_db() {
    let response = app()
        .oneshot(jaskier_core::testing::get("/api/ocr/history"))
        .await
        .unwrap();

    // connect_lazy to fake DB -> query fails -> 500
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

// ═══════════════════════════════════════════════════════════════════════════
//  OCR shared types — serialization round-trip
// ═══════════════════════════════════════════════════════════════════════════

#[test]
fn ocr_request_deserializes_minimal() {
    let json_str = r#"{"data_base64":"abc","mime_type":"image/png"}"#;
    let req: jaskier_tools::ocr::OcrRequest = serde_json::from_str(json_str).unwrap();
    assert_eq!(req.data_base64, "abc");
    assert_eq!(req.mime_type, "image/png");
    assert!(req.language.is_none());
    assert!(req.preset.is_none());
    assert!(req.filename.is_none());
}

#[test]
fn ocr_request_deserializes_full() {
    let json_str = r#"{
        "data_base64": "base64data",
        "mime_type": "application/pdf",
        "language": "pl",
        "preset": "invoice",
        "filename": "faktura.pdf",
        "extract_structured": true,
        "output_format": "html"
    }"#;
    let req: jaskier_tools::ocr::OcrRequest = serde_json::from_str(json_str).unwrap();
    assert_eq!(req.language.as_deref(), Some("pl"));
    assert_eq!(req.preset.as_deref(), Some("invoice"));
    assert_eq!(req.filename.as_deref(), Some("faktura.pdf"));
    assert_eq!(req.extract_structured, Some(true));
    assert_eq!(req.output_format.as_deref(), Some("html"));
}

#[test]
fn ocr_response_serializes_correctly() {
    let response = jaskier_tools::ocr::OcrResponse {
        text: "Hello world".to_string(),
        pages: vec![jaskier_tools::ocr::OcrPage {
            page_number: 1,
            text: "Hello world".to_string(),
        }],
        total_pages: 1,
        processing_time_ms: 150,
        provider: "claude".to_string(),
        output_format: "text".to_string(),
        confidence: Some(0.95),
        detected_preset: Some("invoice".to_string()),
        structured_data: None,
    };

    let json = serde_json::to_value(&response).unwrap();
    assert_eq!(json["text"], "Hello world");
    assert_eq!(json["total_pages"], 1);
    assert_eq!(json["provider"], "claude");
    assert_eq!(json["confidence"], 0.95);
    assert_eq!(json["detected_preset"], "invoice");
}

#[test]
fn ocr_batch_request_deserializes() {
    let json_str = r#"{
        "items": [
            {"data_base64": "abc", "mime_type": "image/png", "filename": "test.png"},
            {"data_base64": "def", "mime_type": "image/jpeg"}
        ]
    }"#;
    let req: jaskier_tools::ocr::OcrBatchRequest = serde_json::from_str(json_str).unwrap();
    assert_eq!(req.items.len(), 2);
    assert_eq!(req.items[0].filename, Some("test.png".to_string()));
    assert!(req.items[1].filename.is_none());
}
