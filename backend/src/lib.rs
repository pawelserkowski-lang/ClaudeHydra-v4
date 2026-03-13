pub mod audit;
pub mod auth;
pub mod browser_proxy;
pub mod handlers;
pub mod logs;
pub mod mcp;
pub mod model_registry;
pub mod models;
pub mod oauth;
pub mod oauth_github;
pub mod oauth_google;
pub mod oauth_vercel;
pub mod ocr;
pub mod rate_limits;
pub mod service_tokens;
pub mod state;
pub mod system_monitor;
pub mod tools;
pub mod watchdog;

use axum::Router;
use axum::extract::DefaultBodyLimit;
use axum::middleware;
use axum::routing::{delete, get, patch, post};
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use state::AppState;

// ═══════════════════════════════════════════════════════════════════════
//  Request correlation ID middleware — Jaskier Shared Pattern
// ═══════════════════════════════════════════════════════════════════════

/// Middleware that generates a UUID v4 correlation ID for each request.
///
/// - Adds it to the current tracing span as `request_id`
/// - Returns it in the `X-Request-Id` response header
/// - Accepts an incoming `X-Request-Id` header to propagate from upstream
async fn request_id_middleware(
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    // Use the incoming X-Request-Id if present, otherwise generate one
    let request_id = req
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    // Add to current tracing span
    tracing::Span::current().record("request_id", request_id.as_str());
    tracing::debug!(request_id = %request_id, "request correlation ID assigned");

    let mut response = next.run(req).await;

    // Add X-Request-Id to response headers
    if let Ok(header_value) = axum::http::HeaderValue::from_str(&request_id) {
        response.headers_mut().insert("x-request-id", header_value);
    }

    response
}

// ── OpenAPI documentation ────────────────────────────────────────────────────

#[derive(OpenApi)]
#[openapi(
    info(
        title = "ClaudeHydra v4 API",
        version = "4.0.0",
        description = "AI Swarm Control Center — Backend API",
        license(name = "MIT")
    ),
    paths(
        // Health
        handlers::health_check,
        handlers::readiness,
        handlers::auth_mode,
        handlers::system_stats,
        handlers::system_metrics,
        handlers::system_audit,
        // Agents
        handlers::list_agents,
        handlers::get_agent,
        handlers::create_agent,
        handlers::update_agent,
        handlers::delete_agent,
        handlers::list_delegations,
        handlers::delegations_stream,
        // Chat
        handlers::claude_models,
        handlers::claude_chat,
        handlers::claude_chat_stream,
        // Settings
        handlers::get_settings,
        handlers::update_settings,
        handlers::set_api_key,
        // Sessions (local overrides with utoipa annotations)
        handlers::get_session,
        handlers::add_session_message,
        // Tags & search
        handlers::get_session_tags,
        handlers::add_session_tags,
        handlers::delete_session_tag,
        handlers::search_sessions,
        handlers::list_all_tags,
        // Model registry
        model_registry::list_models,
        model_registry::refresh_models,
        model_registry::pin_model,
        model_registry::unpin_model,
        model_registry::list_pins,
    ),
    components(schemas(
        // Core models
        models::HealthResponse,
        models::ProviderInfo,
        models::SystemStats,
        models::SystemMetricsResponse,
        models::MetricItem,
        models::NetworkMetric,
        // Agents
        models::WitcherAgent,
        models::CreateAgentRequest,
        models::UpdateAgentRequest,
        // Chat
        models::ChatRequest,
        models::ChatMessage,
        models::ChatResponse,
        models::UsageInfo,
        models::ClaudeModelInfo,
        // Settings
        models::AppSettings,
        models::ApiKeyRequest,
        // Sessions
        models::Session,
        models::SessionSummary,
        models::HistoryEntry,
        models::ToolInteractionInfo,
        models::CreateSessionRequest,
        models::UpdateSessionRequest,
        models::AddMessageRequest,
        // Model registry
        model_registry::ModelInfo,
        model_registry::ResolvedModels,
        model_registry::PinModelRequest,
        // Prompt history
        models::AddPromptRequest,
        // Tags
        handlers::tags::AddTagsRequest,
        handlers::tags::SearchResult,
    )),
    tags(
        (name = "health", description = "Health & readiness endpoints"),
        (name = "auth", description = "Authentication & API key management"),
        (name = "agents", description = "Agent configuration"),
        (name = "chat", description = "Claude chat & streaming"),
        (name = "settings", description = "Application settings"),
        (name = "sessions", description = "Chat session management"),
        (name = "models", description = "Dynamic model registry & pinning"),
        (name = "system", description = "System monitoring"),
        (name = "tags", description = "Session tagging & full-text search"),
    )
)]
pub struct ApiDoc;

// ═══════════════════════════════════════════════════════════════════════
//  Shared route registration — single source of truth for all endpoints
// ═══════════════════════════════════════════════════════════════════════

/// All public routes (no auth required).
/// Includes health checks, OAuth flows, and browser proxy management.
fn public_routes() -> Router<AppState> {
    Router::new()
        .route("/api/health", get(handlers::health_check))
        .route("/api/health/ready", get(handlers::readiness))
        // Anthropic OAuth (PKCE)
        .route("/api/auth/status", get(oauth::auth_status))
        .route("/api/auth/login", post(oauth::auth_login))
        .route("/api/auth/callback", post(oauth::auth_callback))
        .route("/api/auth/logout", post(oauth::auth_logout))
        .route("/api/auth/mode", get(handlers::auth_mode))
        // Google OAuth (public — must be accessible to complete auth flow)
        .route(
            "/api/auth/google/status",
            get(oauth_google::google_auth_status::<AppState>),
        )
        .route(
            "/api/auth/google/login",
            post(oauth_google::google_auth_login::<AppState>),
        )
        .route(
            "/api/auth/google/redirect",
            get(oauth_google::google_redirect::<AppState>),
        )
        .route(
            "/api/auth/google/logout",
            post(oauth_google::google_auth_logout::<AppState>),
        )
        .route(
            "/api/auth/google/apikey",
            post(oauth_google::google_save_api_key::<AppState>).delete(oauth_google::google_delete_api_key::<AppState>),
        )
        // GitHub OAuth (public — must be accessible to complete auth flow)
        .route(
            "/api/auth/github/status",
            get(oauth_github::github_auth_status::<AppState>),
        )
        .route(
            "/api/auth/github/login",
            post(oauth_github::github_auth_login::<AppState>),
        )
        .route(
            "/api/auth/github/callback",
            post(oauth_github::github_auth_callback::<AppState>),
        )
        .route(
            "/api/auth/github/logout",
            post(oauth_github::github_auth_logout::<AppState>),
        )
        // Vercel OAuth (public — must be accessible to complete auth flow)
        .route(
            "/api/auth/vercel/status",
            get(oauth_vercel::vercel_auth_status::<AppState>),
        )
        .route(
            "/api/auth/vercel/login",
            post(oauth_vercel::vercel_auth_login::<AppState>),
        )
        .route(
            "/api/auth/vercel/callback",
            post(oauth_vercel::vercel_auth_callback::<AppState>),
        )
        .route(
            "/api/auth/vercel/logout",
            post(oauth_vercel::vercel_auth_logout::<AppState>),
        )
        // Browser proxy management (public — no auth, proxy handles its own state)
        .route(
            "/api/browser-proxy/status",
            get(browser_proxy::proxy_status::<AppState>),
        )
        .route("/api/browser-proxy/login", post(browser_proxy::proxy_login::<AppState>))
        .route(
            "/api/browser-proxy/login/status",
            get(browser_proxy::proxy_login_status::<AppState>),
        )
        .route(
            "/api/browser-proxy/reinit",
            post(browser_proxy::proxy_reinit::<AppState>),
        )
        .route(
            "/api/browser-proxy/logout",
            delete(browser_proxy::proxy_logout::<AppState>),
        )
        .route(
            "/api/browser-proxy/history",
            get(handlers::browser_proxy_history),
        )
}

/// Streaming chat route (protected, separate for rate limiting in production).
fn chat_stream_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/claude/chat/stream",
            post(handlers::claude_chat_stream),
        )
}

/// Non-streaming chat route (protected, separate for rate limiting in production).
fn chat_routes() -> Router<AppState> {
    Router::new()
        .route("/api/claude/chat", post(handlers::claude_chat))
}

/// A2A delegation routes (protected, separate for rate limiting in production).
fn a2a_routes() -> Router<AppState> {
    Router::new()
        .route("/api/agents/delegations", get(handlers::list_delegations))
        .route(
            "/api/agents/delegations/stream",
            get(handlers::delegations_stream),
        )
}

/// All other protected routes — system, admin, tokens, logs, agents, models,
/// settings, sessions, MCP, OCR, prompt history.
fn general_protected_routes() -> Router<AppState> {
    Router::new()
        .route("/api/system/stats", get(handlers::system_stats))
        // Admin — hot-reload API keys
        .route("/api/admin/rotate-key", post(handlers::rotate_key))
        // Service tokens (Fly.io PAT, etc.) — protected
        .route(
            "/api/tokens",
            get(service_tokens::list_tokens::<AppState>).post(service_tokens::store_token::<AppState>),
        )
        .route(
            "/api/tokens/{service}",
            delete(service_tokens::delete_token::<AppState>),
        )
        // Logs — backend log ring buffer
        .route(
            "/api/logs/backend",
            get(logs::backend_logs::<AppState>).delete(logs::clear_backend_logs::<AppState>),
        )
        .route(
            "/api/agents",
            get(handlers::list_agents).post(handlers::create_agent),
        )
        .route(
            "/api/agents/{id}",
            get(handlers::get_agent)
                .put(handlers::update_agent)
                .delete(handlers::delete_agent),
        )
        .route("/api/agents/refresh", post(handlers::refresh_agents))
        .route("/api/claude/models", get(handlers::claude_models))
        .route("/api/models", get(model_registry::list_models))
        .route("/api/models/refresh", post(model_registry::refresh_models))
        .route("/api/models/pin", post(model_registry::pin_model))
        .route(
            "/api/models/pin/{use_case}",
            delete(model_registry::unpin_model),
        )
        .route("/api/models/pins", get(model_registry::list_pins))
        .route(
            "/api/settings",
            get(handlers::get_settings).post(handlers::update_settings),
        )
        .route("/api/settings/api-key", post(handlers::set_api_key))
        // Sessions — shared generic handlers via jaskier_core::sessions
        .route(
            "/api/sessions",
            get(handlers::list_sessions::<AppState>).post(handlers::create_session::<AppState>),
        )
        // Session search (literal path — precedes {id} wildcard)
        .route("/api/sessions/search", get(handlers::search_sessions))
        .route(
            "/api/sessions/{id}",
            get(handlers::get_session)
                .patch(handlers::update_session::<AppState>)
                .delete(handlers::delete_session::<AppState>),
        )
        .route(
            "/api/sessions/{id}/working-directory",
            patch(handlers::update_session_working_directory::<AppState>),
        )
        .route("/api/files/list", post(handlers::list_files))
        .route("/api/files/browse", post(handlers::browse_directory))
        // Session messages — local override (tool_interactions support)
        .route(
            "/api/sessions/{id}/messages",
            post(handlers::add_session_message),
        )
        // Session tags
        .route(
            "/api/sessions/{id}/tags",
            get(handlers::get_session_tags).post(handlers::add_session_tags),
        )
        .route(
            "/api/sessions/{id}/tags/{tag}",
            delete(handlers::delete_session_tag),
        )
        // All tags (global)
        .route("/api/tags", get(handlers::list_all_tags))
        .route(
            "/api/sessions/{id}/generate-title",
            post(handlers::generate_session_title::<AppState>),
        )
        // ── MCP routes (Phase 9 + 10) ────────────────────────────────
        .route(
            "/api/mcp/servers",
            get(mcp::config::list_servers_handler).post(mcp::config::create_server_handler),
        )
        .route(
            "/api/mcp/servers/{id}",
            patch(mcp::config::update_server_handler).delete(mcp::config::delete_server_handler),
        )
        .route(
            "/api/mcp/servers/{id}/connect",
            post(mcp::config::connect_server_handler),
        )
        .route(
            "/api/mcp/servers/{id}/disconnect",
            post(mcp::config::disconnect_server_handler),
        )
        .route(
            "/api/mcp/servers/{id}/tools",
            get(mcp::config::list_server_tools_handler),
        )
        .route("/api/mcp/tools", get(mcp::config::list_all_tools_handler))
        .route("/mcp", post(mcp::server::mcp_handler::<AppState>))
        // OCR — text extraction from images and PDFs
        .route("/api/ocr", post(ocr::ocr))
        .route("/api/ocr/stream", post(ocr::ocr_stream))
        .route("/api/ocr/batch/stream", post(ocr::ocr_batch_stream))
        .route("/api/ocr/history", get(ocr::ocr_history))
        .route(
            "/api/ocr/history/{id}",
            get(ocr::ocr_history_item).delete(ocr::ocr_history_delete),
        )
        // Prompt history — shared generic handlers via jaskier_core::sessions
        .route(
            "/api/prompt-history",
            get(handlers::list_prompt_history::<AppState>)
                .post(handlers::add_prompt_history::<AppState>)
                .delete(handlers::clear_prompt_history::<AppState>),
        )
        // Analytics — agent performance dashboard
        .route("/api/analytics/tokens", get(handlers::analytics_tokens))
        .route("/api/analytics/latency", get(handlers::analytics_latency))
        .route(
            "/api/analytics/success-rate",
            get(handlers::analytics_success_rate),
        )
        .route(
            "/api/analytics/top-tools",
            get(handlers::analytics_top_tools),
        )
        .route("/api/analytics/cost", get(handlers::analytics_cost))
}

/// Routes that require API key authentication (system metrics/audit).
fn api_key_auth_routes() -> Router<AppState> {
    Router::new()
        .route("/api/system/metrics", get(handlers::system_metrics))
        .route("/api/system/audit", get(handlers::system_audit))
}

/// Extra routes: Prometheus metrics (public), v1 API aliases, WebSocket.
fn extra_routes() -> Router<AppState> {
    // ── Metrics endpoint (public, no auth) — shared handler from jaskier-core
    let metrics = Router::new().route(
        "/api/metrics",
        get(jaskier_core::metrics::metrics_handler::<AppState>),
    );

    // ── API v1 prefix alias (mirrors /api routes for forward compat) ─
    let v1_public = Router::new()
        .route("/api/v1/health", get(handlers::health_check))
        .route("/api/v1/health/ready", get(handlers::readiness))
        .route("/api/v1/auth/mode", get(handlers::auth_mode));

    // ── WebSocket route (auth via ?token query param, outside middleware) ─
    let ws_routes = Router::new().route("/ws/chat", get(handlers::ws_chat));

    metrics.merge(v1_public).merge(ws_routes)
}

/// Assemble the final `Router` from pre-built route groups + shared state.
/// Adds Swagger UI, body limit, request correlation ID, and binds state.
fn assemble_app(
    state: AppState,
    public: Router<AppState>,
    protected: Router<AppState>,
    api_key: Router<AppState>,
    extra: Router<AppState>,
) -> Router {
    public
        .merge(protected)
        .merge(api_key)
        .merge(extra)
        // Swagger UI — no auth required
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        // 60 MB body limit — must be before .with_state() for Json extractor
        .layer(DefaultBodyLimit::max(60 * 1024 * 1024))
        // Request correlation ID — adds X-Request-Id header to every response
        .layer(axum::middleware::from_fn(request_id_middleware))
        .with_state(state)
}

/// Build the application router with the given shared state.
/// Extracted from `main()` so integration tests can construct the app
/// without binding to a network port.
///
/// Rate limits are loaded from `state.rate_limit_config` (populated from DB
/// at startup with hardcoded fallbacks). Changes via the admin API take
/// effect on next server restart.
pub fn create_router(state: AppState) -> Router {
    // ── #21 Per-endpoint rate limiting — DB-configurable ──────────────
    let rl_cfg = &state.rate_limit_config;

    let p_chat_stream = rl_cfg.get("chat_stream");
    let p_chat = rl_cfg.get("chat");
    let p_a2a = rl_cfg.get("a2a");
    let p_default = rl_cfg.get("default");

    // Build GovernorConfig from DB-loaded params
    let gov_chat_stream = GovernorConfigBuilder::default()
        .per_millisecond(p_chat_stream.interval_ms)
        .burst_size(p_chat_stream.burst_size)
        .finish()
        .expect("rate limiter config: chat_stream");
    let gov_chat = GovernorConfigBuilder::default()
        .per_millisecond(p_chat.interval_ms)
        .burst_size(p_chat.burst_size)
        .finish()
        .expect("rate limiter config: chat");
    let gov_a2a = GovernorConfigBuilder::default()
        .per_millisecond(p_a2a.interval_ms)
        .burst_size(p_a2a.burst_size)
        .finish()
        .expect("rate limiter config: a2a");
    let gov_default = GovernorConfigBuilder::default()
        .per_millisecond(p_default.interval_ms)
        .burst_size(p_default.burst_size)
        .finish()
        .expect("rate limiter config: default");

    // Apply rate limiters to each route group (skip layer if disabled in DB)
    let mut protected: Router<AppState> = Router::new();

    if p_chat_stream.enabled {
        protected = protected.merge(chat_stream_routes().layer(GovernorLayer::new(gov_chat_stream)));
    } else {
        protected = protected.merge(chat_stream_routes());
    }

    if p_chat.enabled {
        protected = protected.merge(chat_routes().layer(GovernorLayer::new(gov_chat)));
    } else {
        protected = protected.merge(chat_routes());
    }

    if p_a2a.enabled {
        protected = protected.merge(a2a_routes().layer(GovernorLayer::new(gov_a2a)));
    } else {
        protected = protected.merge(a2a_routes());
    }

    if p_default.enabled {
        protected = protected.merge(general_protected_routes().layer(GovernorLayer::new(gov_default)));
    } else {
        protected = protected.merge(general_protected_routes());
    }

    // Admin rate-limits management endpoints (inside auth-protected group)
    protected = protected
        .route(
            "/api/admin/rate-limits",
            get(rate_limits::list_rate_limits),
        )
        .route(
            "/api/admin/rate-limits/{endpoint_group}",
            patch(rate_limits::update_rate_limit),
        );

    protected = protected.route_layer(middleware::from_fn_with_state(
        state.clone(),
        auth::require_auth::<AppState>,
    ));

    let gov_system = GovernorConfigBuilder::default()
        .per_millisecond(p_default.interval_ms)
        .burst_size(p_default.burst_size)
        .finish()
        .expect("rate limiter config: system");

    let api_key = api_key_auth_routes()
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key_auth,
        ))
        .layer(GovernorLayer::new(gov_system));

    assemble_app(state, public_routes(), protected, api_key, extra_routes())
}

/// Test-only router — identical routes but **without** `GovernorLayer` rate
/// limiting.  `tower_governor` extracts the peer IP via `ConnectInfo`, which
/// is absent in `oneshot()` integration tests, causing a blanket 500
/// "Unable To Extract Key!" error.  Removing the layer keeps all handler
/// logic intact while allowing pure in-memory tests.
#[doc(hidden)]
pub fn create_test_router(state: AppState) -> Router {
    // All protected routes merged flat — no rate limiting
    let protected = chat_stream_routes()
        .merge(chat_routes())
        .merge(a2a_routes())
        .merge(general_protected_routes())
        // Admin rate-limits management (also available in test router)
        .route(
            "/api/admin/rate-limits",
            get(rate_limits::list_rate_limits),
        )
        .route(
            "/api/admin/rate-limits/{endpoint_group}",
            patch(rate_limits::update_rate_limit),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_auth::<AppState>,
        ));

    let api_key = api_key_auth_routes()
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key_auth,
        ));

    assemble_app(state, public_routes(), protected, api_key, extra_routes())
}

// ── Prometheus metrics — shared handler from jaskier_core::metrics ────────
// See `jaskier_core::metrics::metrics_handler` + `HasMetricsState` trait impl
// in `state.rs`. Route registered in `extra_routes()` above.
