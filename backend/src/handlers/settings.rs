//! Application settings endpoints (DB-backed).

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use serde_json::{Value, json};

use crate::models::*;
use crate::state::AppState;

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/settings
// ═══════════════════════════════════════════════════════════════════════

#[utoipa::path(get, path = "/api/settings", tag = "settings",
    responses((status = 200, description = "Current application settings")))]
pub async fn get_settings(State(state): State<AppState>) -> Result<Json<Value>, StatusCode> {
    let row = sqlx::query_as::<_, SettingsRow>(
        "SELECT theme, language, default_model, auto_start, welcome_message, working_directory, \
         COALESCE(max_iterations, 10) AS max_iterations, \
         COALESCE(temperature, 0.7) AS temperature, \
         COALESCE(max_tokens, 4096) AS max_tokens, \
         COALESCE(custom_instructions, '') AS custom_instructions, \
         COALESCE(auto_updater, TRUE) AS auto_updater, \
         COALESCE(telemetry, FALSE) AS telemetry, \
         COALESCE(compaction_threshold, 25) AS compaction_threshold, \
         COALESCE(compaction_keep, 15) AS compaction_keep \
         FROM ch_settings WHERE id = 1",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch settings: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let settings = AppSettings {
        theme: row.theme,
        language: row.language,
        default_model: row.default_model,
        auto_start: row.auto_start,
        welcome_message: row.welcome_message,
        working_directory: row.working_directory,
        max_iterations: row.max_iterations,
        temperature: row.temperature,
        max_tokens: row.max_tokens,
        custom_instructions: row.custom_instructions,
        auto_updater: row.auto_updater,
        telemetry: row.telemetry,
        compaction_threshold: row.compaction_threshold,
        compaction_keep: row.compaction_keep,
    };

    Ok(Json(
        serde_json::to_value(settings).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    ))
}

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/settings
// ═══════════════════════════════════════════════════════════════════════

#[utoipa::path(post, path = "/api/settings", tag = "settings",
    request_body = AppSettings,
    responses((status = 200, description = "Updated settings")))]
pub async fn update_settings(
    State(state): State<AppState>,
    Json(new_settings): Json<AppSettings>,
) -> Result<Json<Value>, StatusCode> {
    // Validate working_directory if non-empty
    if !new_settings.working_directory.is_empty()
        && !std::path::Path::new(&new_settings.working_directory).is_dir()
    {
        return Err(StatusCode::BAD_REQUEST);
    }

    sqlx::query(
        "UPDATE ch_settings SET theme = $1, language = $2, default_model = $3, \
         auto_start = $4, welcome_message = $5, working_directory = $6, max_iterations = $7, \
         temperature = $8, max_tokens = $9, custom_instructions = $10, \
         auto_updater = $11, telemetry = $12, \
         compaction_threshold = $13, compaction_keep = $14, \
         updated_at = NOW() WHERE id = 1",
    )
    .bind(&new_settings.theme)
    .bind(&new_settings.language)
    .bind(&new_settings.default_model)
    .bind(new_settings.auto_start)
    .bind(&new_settings.welcome_message)
    .bind(&new_settings.working_directory)
    .bind(new_settings.max_iterations.clamp(1, 50))
    .bind(new_settings.temperature.clamp(0.0, 2.0))
    .bind(new_settings.max_tokens.clamp(256, 16384))
    .bind(&new_settings.custom_instructions)
    .bind(new_settings.auto_updater)
    .bind(new_settings.telemetry)
    .bind(new_settings.compaction_threshold.clamp(10, 100))
    .bind(new_settings.compaction_keep.clamp(5, 50))
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update settings: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    crate::audit::log_audit(
        &state.db,
        "update_settings",
        serde_json::to_value(&new_settings).unwrap_or_default(),
        None,
    )
    .await;

    Ok(Json(
        serde_json::to_value(&new_settings).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
    ))
}

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/settings/api-key
// ═══════════════════════════════════════════════════════════════════════

#[utoipa::path(post, path = "/api/settings/api-key", tag = "auth",
    request_body = ApiKeyRequest,
    responses((status = 200, description = "API key saved")))]
pub async fn set_api_key(
    State(state): State<AppState>,
    Json(req): Json<ApiKeyRequest>,
) -> Json<Value> {
    let mut rt = state.runtime.write().await;
    rt.api_keys.insert(req.provider.clone(), req.key);
    Json(json!({ "status": "ok", "provider": req.provider }))
}
