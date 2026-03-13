//! Configurable per-endpoint rate limits — loaded from DB at startup,
//! with hardcoded fallbacks if the table doesn't exist yet.
//!
//! Rate limit changes take effect on next server restart (no hot-reload).

use std::collections::HashMap;

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::PgPool;

use crate::state::AppState;

// ── Types ────────────────────────────────────────────────────────────────

/// A single rate limit configuration entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitEntry {
    pub endpoint_group: String,
    pub requests_per_minute: i32,
    pub burst_size: i32,
    pub enabled: bool,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// DB row for `ch_rate_limits`.
#[derive(sqlx::FromRow)]
struct RateLimitRow {
    #[allow(dead_code)]
    id: i32,
    endpoint_group: String,
    requests_per_minute: i32,
    burst_size: i32,
    enabled: bool,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Resolved rate limit parameters for a single endpoint group.
#[derive(Debug, Clone)]
pub struct RateLimitParams {
    /// Interval between requests in milliseconds.
    pub interval_ms: u64,
    /// Maximum burst size.
    pub burst_size: u32,
    /// Whether rate limiting is enabled for this group.
    pub enabled: bool,
}

/// All loaded rate limit configs, keyed by endpoint_group.
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub groups: HashMap<String, RateLimitParams>,
}

// ── Hardcoded defaults ───────────────────────────────────────────────────

/// Return hardcoded default rate limit config (matches original GovernorLayer values).
fn hardcoded_defaults() -> RateLimitConfig {
    let mut groups = HashMap::new();

    // Chat streaming: 20 req/min → 1 per 3s, burst 20
    groups.insert(
        "chat_stream".to_string(),
        RateLimitParams {
            interval_ms: 3000,
            burst_size: 20,
            enabled: true,
        },
    );

    // Chat non-streaming: 30 req/min → 1 per 2s, burst 30
    groups.insert(
        "chat".to_string(),
        RateLimitParams {
            interval_ms: 2000,
            burst_size: 30,
            enabled: true,
        },
    );

    // A2A delegation: 10 req/min → 1 per 6s, burst 3
    groups.insert(
        "a2a".to_string(),
        RateLimitParams {
            interval_ms: 6000,
            burst_size: 3,
            enabled: true,
        },
    );

    // Default (other protected routes): 120 req/min → 1 per 0.5s, burst 120
    groups.insert(
        "default".to_string(),
        RateLimitParams {
            interval_ms: 500,
            burst_size: 120,
            enabled: true,
        },
    );

    RateLimitConfig { groups }
}

/// Convert requests_per_minute to an interval in milliseconds.
fn rpm_to_interval_ms(rpm: i32) -> u64 {
    if rpm <= 0 {
        return 60_000; // fallback: 1 per minute
    }
    (60_000u64) / (rpm as u64)
}

// ── DB loading ───────────────────────────────────────────────────────────

/// Load rate limit configuration from the database.
/// Falls back to hardcoded defaults if the table doesn't exist or query fails.
pub async fn load_from_db(db: &PgPool) -> RateLimitConfig {
    let defaults = hardcoded_defaults();

    let rows = match sqlx::query_as::<_, RateLimitRow>(
        "SELECT id, endpoint_group, requests_per_minute, burst_size, enabled, updated_at \
         FROM ch_rate_limits ORDER BY endpoint_group",
    )
    .fetch_all(db)
    .await
    {
        Ok(rows) if !rows.is_empty() => rows,
        Ok(_) => {
            tracing::info!("ch_rate_limits table is empty — using hardcoded defaults");
            return defaults;
        }
        Err(e) => {
            tracing::warn!(
                "Failed to load rate limits from DB ({}), using hardcoded defaults",
                e
            );
            return defaults;
        }
    };

    let mut groups = HashMap::new();

    for row in &rows {
        groups.insert(
            row.endpoint_group.clone(),
            RateLimitParams {
                interval_ms: rpm_to_interval_ms(row.requests_per_minute),
                burst_size: row.burst_size.max(1) as u32,
                enabled: row.enabled,
            },
        );
    }

    // Fill in any missing groups from hardcoded defaults
    for (key, default_params) in &defaults.groups {
        groups.entry(key.clone()).or_insert_with(|| default_params.clone());
    }

    tracing::info!(
        "Loaded {} rate limit configs from DB: {:?}",
        rows.len(),
        rows.iter()
            .map(|r| format!(
                "{}={}/min burst={}{}",
                r.endpoint_group,
                r.requests_per_minute,
                r.burst_size,
                if !r.enabled { " (disabled)" } else { "" }
            ))
            .collect::<Vec<_>>()
    );

    RateLimitConfig { groups }
}

impl RateLimitConfig {
    /// Get params for a specific group, falling back to "default" group,
    /// then to hardcoded 120 req/min if even "default" is missing.
    pub fn get(&self, group: &str) -> RateLimitParams {
        self.groups
            .get(group)
            .or_else(|| self.groups.get("default"))
            .cloned()
            .unwrap_or(RateLimitParams {
                interval_ms: 500,
                burst_size: 120,
                enabled: true,
            })
    }
}

// ── Admin endpoints ──────────────────────────────────────────────────────

/// GET /api/admin/rate-limits — list all rate limit configurations.
pub async fn list_rate_limits(
    State(state): State<AppState>,
) -> Result<Json<Value>, StatusCode> {
    let rows = sqlx::query_as::<_, RateLimitRow>(
        "SELECT id, endpoint_group, requests_per_minute, burst_size, enabled, updated_at \
         FROM ch_rate_limits ORDER BY endpoint_group",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list rate limits: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let entries: Vec<RateLimitEntry> = rows
        .into_iter()
        .map(|r| RateLimitEntry {
            endpoint_group: r.endpoint_group,
            requests_per_minute: r.requests_per_minute,
            burst_size: r.burst_size,
            enabled: r.enabled,
            updated_at: r.updated_at,
        })
        .collect();

    Ok(Json(json!({
        "rate_limits": entries,
        "note": "Changes take effect on next server restart"
    })))
}

/// Request body for PATCH /api/admin/rate-limits/{endpoint_group}.
#[derive(Debug, Deserialize)]
pub struct UpdateRateLimitRequest {
    pub requests_per_minute: Option<i32>,
    pub burst_size: Option<i32>,
    pub enabled: Option<bool>,
}

/// PATCH /api/admin/rate-limits/{endpoint_group} — update rate limit for a group.
pub async fn update_rate_limit(
    State(state): State<AppState>,
    Path(endpoint_group): Path<String>,
    Json(body): Json<UpdateRateLimitRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Validate that the endpoint_group exists
    let exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM ch_rate_limits WHERE endpoint_group = $1",
    )
    .bind(&endpoint_group)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to check rate limit existence: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Database error" })),
        )
    })?;

    if exists == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("Rate limit group '{}' not found", endpoint_group) })),
        ));
    }

    // Validate values if provided
    if let Some(rpm) = body.requests_per_minute {
        if rpm < 1 || rpm > 10_000 {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "requests_per_minute must be between 1 and 10000" })),
            ));
        }
    }
    if let Some(burst) = body.burst_size {
        if burst < 1 || burst > 10_000 {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "burst_size must be between 1 and 10000" })),
            ));
        }
    }

    // Build dynamic UPDATE query
    let mut set_clauses = vec!["updated_at = NOW()".to_string()];
    let mut param_index = 1u32;

    // We'll collect params and build the query dynamically
    if body.requests_per_minute.is_some() {
        param_index += 1;
        set_clauses.push(format!("requests_per_minute = ${}", param_index));
    }
    if body.burst_size.is_some() {
        param_index += 1;
        set_clauses.push(format!("burst_size = ${}", param_index));
    }
    if body.enabled.is_some() {
        param_index += 1;
        set_clauses.push(format!("enabled = ${}", param_index));
    }

    if set_clauses.len() == 1 {
        // Only "updated_at = NOW()" — no actual changes
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "No fields to update" })),
        ));
    }

    let query = format!(
        "UPDATE ch_rate_limits SET {} WHERE endpoint_group = $1",
        set_clauses.join(", ")
    );

    let mut q = sqlx::query(&query).bind(&endpoint_group);

    if let Some(rpm) = body.requests_per_minute {
        q = q.bind(rpm);
    }
    if let Some(burst) = body.burst_size {
        q = q.bind(burst);
    }
    if let Some(enabled) = body.enabled {
        q = q.bind(enabled);
    }

    q.execute(&state.db).await.map_err(|e| {
        tracing::error!("Failed to update rate limit: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to update rate limit" })),
        )
    })?;

    // Audit log
    crate::audit::log_audit(
        &state.db,
        "update_rate_limit",
        json!({
            "endpoint_group": endpoint_group,
            "requests_per_minute": body.requests_per_minute,
            "burst_size": body.burst_size,
            "enabled": body.enabled,
        }),
        None,
    )
    .await;

    tracing::info!(
        "Rate limit updated: {} (rpm={:?}, burst={:?}, enabled={:?}) — takes effect on restart",
        endpoint_group,
        body.requests_per_minute,
        body.burst_size,
        body.enabled,
    );

    Ok(Json(json!({
        "status": "updated",
        "endpoint_group": endpoint_group,
        "note": "Changes take effect on next server restart"
    })))
}
