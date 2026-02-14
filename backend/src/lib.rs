pub mod handlers;
pub mod models;
pub mod state;

use std::sync::{Arc, Mutex};

use axum::routing::{get, post};
use axum::Router;

use state::AppState;

/// Build the application router with the given shared state.
/// Extracted from `main()` so integration tests can construct the app
/// without binding to a network port.
pub fn create_router(shared_state: Arc<Mutex<AppState>>) -> Router {
    Router::new()
        // Health & system
        .route("/api/health", get(handlers::health_check))
        .route("/api/system/stats", get(handlers::system_stats))
        // Agents
        .route("/api/agents", get(handlers::list_agents))
        // Claude API
        .route("/api/claude/models", get(handlers::claude_models))
        .route("/api/claude/chat", post(handlers::claude_chat))
        .route(
            "/api/claude/chat/stream",
            post(handlers::claude_chat_stream),
        )
        // Settings
        .route(
            "/api/settings",
            get(handlers::get_settings).post(handlers::update_settings),
        )
        .route("/api/settings/api-key", post(handlers::set_api_key))
        // Sessions & history
        .route(
            "/api/sessions",
            get(handlers::list_sessions).post(handlers::create_session),
        )
        .route(
            "/api/sessions/{id}",
            get(handlers::get_session).delete(handlers::delete_session),
        )
        .route(
            "/api/sessions/{id}/messages",
            post(handlers::add_session_message),
        )
        // Shared state
        .with_state(shared_state)
}
