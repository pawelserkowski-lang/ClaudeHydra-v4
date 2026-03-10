// Jaskier Shared Pattern — Vercel OAuth
// Stores Vercel OAuth access tokens with AES-256-GCM encryption.
// Reuses encrypt_token/decrypt_token from oauth.rs.

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::oauth::{decrypt_token, encrypt_token, random_base64url};
use crate::state::AppState;

// ── Vercel OAuth constants ───────────────────────────────────────────────

const VERCEL_AUTHORIZE_URL: &str = "https://vercel.com/integrations/oauthdialog";
const VERCEL_TOKEN_URL: &str = "https://api.vercel.com/v2/oauth/access_token";

// ── DB row ───────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct VercelTokenRow {
    access_token: String,
    team_id: Option<String>,
}

#[derive(Deserialize)]
struct VercelTokenResponse {
    access_token: String,
    team_id: Option<String>,
}

// ═══════════════════════════════════════════════════════════════════════
//  Handlers
// ═══════════════════════════════════════════════════════════════════════

/// GET /api/auth/vercel/status
pub async fn vercel_auth_status(State(state): State<AppState>) -> Json<Value> {
    match get_vercel_token_row(&state).await {
        Some(row) => {
            let valid = decrypt_token(&row.access_token).is_some();
            Json(json!({
                "authenticated": valid,
                "team_id": row.team_id,
            }))
        }
        None => Json(json!({ "authenticated": false })),
    }
}

/// POST /api/auth/vercel/login — return Vercel authorize URL
pub async fn vercel_auth_login(State(state): State<AppState>) -> Json<Value> {
    let client_id = std::env::var("VERCEL_CLIENT_ID").unwrap_or_default();
    if client_id.is_empty() {
        tracing::error!("vercel oauth: VERCEL_CLIENT_ID not configured");
        return Json(json!({ "error": "Vercel authentication not configured" }));
    }

    let redirect_uri = std::env::var("VERCEL_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost:5199/api/auth/vercel/callback".to_string());

    // Generate random state
    let oauth_state = random_base64url(32);

    {
        let mut states = state.vercel_oauth_states.write().await;
        // Prune expired entries (>10 min old)
        states.retain(|_, created| created.elapsed() < crate::state::OAUTH_STATE_TTL);
        states.insert(oauth_state.clone(), tokio::time::Instant::now());
    }

    let mut auth_url = url::Url::parse(VERCEL_AUTHORIZE_URL)
        .expect("VERCEL_AUTHORIZE_URL is a valid hardcoded URL");
    auth_url
        .query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("state", &oauth_state);

    Json(json!({
        "auth_url": auth_url.to_string(),
        "state": oauth_state,
    }))
}

#[derive(Deserialize)]
pub struct VercelCallbackRequest {
    pub code: String,
    pub state: String,
}

/// POST /api/auth/vercel/callback — exchange code for token
pub async fn vercel_auth_callback(
    State(state): State<AppState>,
    Json(req): Json<VercelCallbackRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Verify state — remove() validates AND consumes atomically
    {
        let mut states = state.vercel_oauth_states.write().await;
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

    let client_id = std::env::var("VERCEL_CLIENT_ID").unwrap_or_default();
    let client_secret = std::env::var("VERCEL_CLIENT_SECRET").unwrap_or_default();
    let redirect_uri = std::env::var("VERCEL_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost:5199/api/auth/vercel/callback".to_string());

    if client_id.is_empty() || client_secret.is_empty() {
        tracing::error!("vercel oauth: VERCEL_CLIENT_ID or VERCEL_CLIENT_SECRET not configured");
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Authentication failed" })),
        ));
    }

    // Exchange code for token (Vercel uses JSON body)
    let resp = state
        .http_client
        .post(VERCEL_TOKEN_URL)
        .header("content-type", "application/json")
        .json(&json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": req.code,
            "redirect_uri": redirect_uri,
        }))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Vercel token exchange request failed: {}", e);
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": "Vercel token exchange failed" })),
            )
        })?;

    if !resp.status().is_success() {
        let err = resp.text().await.unwrap_or_default();
        tracing::error!("Vercel rejected token exchange: {}", err);
        return Err((
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": "Vercel token exchange failed" })),
        ));
    }

    let token_resp: VercelTokenResponse = resp.json().await.map_err(|e| {
        tracing::error!("Invalid token response from Vercel: {}", e);
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": "Vercel token exchange failed" })),
        )
    })?;

    let encrypted_access = encrypt_token(&token_resp.access_token);

    sqlx::query(concat!(
        "INSERT INTO ",
        "ch_oauth_vercel",
        " (id, access_token, team_id, updated_at) ",
        "VALUES (1, $1, $2, NOW()) ",
        "ON CONFLICT (id) DO UPDATE SET ",
        "access_token = $1, team_id = $2, updated_at = NOW()"
    ))
    .bind(&encrypted_access)
    .bind(&token_resp.team_id)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to store Vercel token: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to store authentication data" })),
        )
    })?;

    tracing::info!("Vercel OAuth login successful");

    Ok(Json(json!({
        "status": "ok",
        "authenticated": true,
        "team_id": token_resp.team_id,
    })))
}

/// POST /api/auth/vercel/logout — delete stored Vercel OAuth token
pub async fn vercel_auth_logout(State(state): State<AppState>) -> Json<Value> {
    sqlx::query(concat!("DELETE FROM ", "ch_oauth_vercel", " WHERE id = 1"))
        .execute(&state.db)
        .await
        .ok();
    tracing::info!("Vercel OAuth token deleted");
    Json(json!({ "status": "ok" }))
}

// ═══════════════════════════════════════════════════════════════════════
//  Token access (used by tools)
// ═══════════════════════════════════════════════════════════════════════

/// Get a valid Vercel access token (decrypted) + optional team_id.
pub async fn get_vercel_access_token(state: &AppState) -> Option<(String, Option<String>)> {
    let row = get_vercel_token_row(state).await?;
    let token = decrypt_token(&row.access_token)?;
    Some((token, row.team_id))
}

// ── Helpers ──────────────────────────────────────────────────────────────

async fn get_vercel_token_row(state: &AppState) -> Option<VercelTokenRow> {
    sqlx::query_as::<_, VercelTokenRow>(concat!(
        "SELECT access_token, team_id FROM ",
        "ch_oauth_vercel",
        " WHERE id = 1"
    ))
    .fetch_optional(&state.db)
    .await
    .ok()?
}
