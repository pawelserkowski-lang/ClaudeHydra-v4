// Jaskier Shared Pattern — GitHub OAuth
// Stores GitHub OAuth access tokens with AES-256-GCM encryption.
// Reuses encrypt_token/decrypt_token from oauth.rs.

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::oauth::{decrypt_token, encrypt_token, random_base64url};
use crate::state::AppState;

// ── GitHub OAuth constants ───────────────────────────────────────────────

const GITHUB_AUTHORIZE_URL: &str = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const DEFAULT_SCOPE: &str = "repo read:user";

// ── DB row ───────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct GitHubTokenRow {
    access_token: String,
    scope: String,
}

#[derive(Deserialize)]
struct GitHubTokenResponse {
    access_token: String,
    token_type: String,
    scope: String,
}

// ═══════════════════════════════════════════════════════════════════════
//  Handlers
// ═══════════════════════════════════════════════════════════════════════

/// GET /api/auth/github/status
pub async fn github_auth_status(State(state): State<AppState>) -> Json<Value> {
    match get_github_token_row(&state).await {
        Some(row) => {
            // Verify token can be decrypted
            let valid = decrypt_token(&row.access_token).is_some();
            Json(json!({
                "authenticated": valid,
                "scope": row.scope,
            }))
        }
        None => Json(json!({ "authenticated": false })),
    }
}

/// POST /api/auth/github/login — return GitHub authorize URL
pub async fn github_auth_login(State(state): State<AppState>) -> Json<Value> {
    let client_id = std::env::var("GITHUB_CLIENT_ID").unwrap_or_default();
    if client_id.is_empty() {
        tracing::error!("github oauth: GITHUB_CLIENT_ID not configured");
        return Json(json!({ "error": "GitHub authentication not configured" }));
    }

    // Generate a random state parameter for CSRF protection
    let oauth_state = random_base64url(32);

    {
        let mut states = state.github_oauth_states.write().await;
        // Prune expired entries (>10 min old)
        states.retain(|_, created| created.elapsed() < crate::state::OAUTH_STATE_TTL);
        states.insert(oauth_state.clone(), tokio::time::Instant::now());
    }

    let mut auth_url = url::Url::parse(GITHUB_AUTHORIZE_URL)
        .expect("GITHUB_AUTHORIZE_URL is a valid hardcoded URL");
    auth_url
        .query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("scope", DEFAULT_SCOPE)
        .append_pair("state", &oauth_state);

    Json(json!({
        "auth_url": auth_url.to_string(),
        "state": oauth_state,
    }))
}

#[derive(Deserialize)]
pub struct GitHubCallbackRequest {
    pub code: String,
    pub state: String,
}

/// POST /api/auth/github/callback — exchange code for token
pub async fn github_auth_callback(
    State(state): State<AppState>,
    Json(req): Json<GitHubCallbackRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Verify state parameter — remove() validates AND consumes atomically
    {
        let mut states = state.github_oauth_states.write().await;
        match states.remove(&req.state) {
            Some(created) if created.elapsed() < crate::state::OAUTH_STATE_TTL => {}
            Some(_) => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "OAuth state expired" })),
                ));
            }
            None => {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Invalid or expired OAuth state" })),
                ));
            }
        }
    }

    let client_id = std::env::var("GITHUB_CLIENT_ID").unwrap_or_default();
    let client_secret = std::env::var("GITHUB_CLIENT_SECRET").unwrap_or_default();

    if client_id.is_empty() || client_secret.is_empty() {
        tracing::error!("github oauth: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not configured");
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Authentication failed" })),
        ));
    }

    // Exchange code for token
    let resp = state
        .http_client
        .post(GITHUB_TOKEN_URL)
        .header("accept", "application/json")
        .json(&json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": req.code,
            "state": req.state,
        }))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| {
            tracing::error!("GitHub token exchange request failed: {}", e);
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": "GitHub token exchange failed" })),
            )
        })?;

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        tracing::error!("GitHub rejected token exchange: {}", err);
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": "GitHub token exchange failed" })),
        ));
    }

    let token_resp: GitHubTokenResponse = resp.json().await.map_err(|e| {
        tracing::error!("Invalid token response from GitHub: {}", e);
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": "GitHub token exchange failed" })),
        )
    })?;

    // Encrypt token before DB storage
    let encrypted_access = encrypt_token(&token_resp.access_token);

    // Upsert into DB — table name via concat!()
    sqlx::query(concat!(
        "INSERT INTO ",
        "ch_oauth_github",
        " (id, access_token, token_type, scope, updated_at) ",
        "VALUES (1, $1, $2, $3, NOW()) ",
        "ON CONFLICT (id) DO UPDATE SET ",
        "access_token = $1, token_type = $2, scope = $3, updated_at = NOW()"
    ))
    .bind(&encrypted_access)
    .bind(&token_resp.token_type)
    .bind(&token_resp.scope)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to store GitHub token: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to store authentication data" })),
        )
    })?;

    tracing::info!("GitHub OAuth login successful");

    Ok(Json(json!({
        "status": "ok",
        "authenticated": true,
        "scope": token_resp.scope,
    })))
}

/// POST /api/auth/github/logout — delete stored GitHub OAuth token
pub async fn github_auth_logout(State(state): State<AppState>) -> Json<Value> {
    sqlx::query(concat!("DELETE FROM ", "ch_oauth_github", " WHERE id = 1"))
        .execute(&state.db)
        .await
        .ok();
    tracing::info!("GitHub OAuth token deleted");
    Json(json!({ "status": "ok" }))
}

// ═══════════════════════════════════════════════════════════════════════
//  Token access (used by tools)
// ═══════════════════════════════════════════════════════════════════════

/// Get a valid GitHub access token (decrypted).
pub async fn get_github_access_token(state: &AppState) -> Option<String> {
    let row = get_github_token_row(state).await?;
    decrypt_token(&row.access_token)
}

// ── Helpers ──────────────────────────────────────────────────────────────

async fn get_github_token_row(state: &AppState) -> Option<GitHubTokenRow> {
    sqlx::query_as::<_, GitHubTokenRow>(concat!(
        "SELECT access_token, scope FROM ",
        "ch_oauth_github",
        " WHERE id = 1"
    ))
    .fetch_optional(&state.db)
    .await
    .ok()?
}
