//! Analytics aggregation endpoints for the Agent Performance Dashboard.
//!
//! Provides token usage, latency, success rate, top tools, and cost estimates
//! from `ch_agent_usage` and `ch_tool_interactions` tables.

use axum::Json;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::state::AppState;

// ── Query params ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TimeRangeQuery {
    /// Number of days to look back (default: 7)
    pub days: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct TopToolsQuery {
    /// Number of days to look back (default: 7)
    pub days: Option<i32>,
    /// Max tools to return (default: 10)
    pub limit: Option<i32>,
}

// ── Response types ──────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct DailyTokenUsage {
    pub day: String,
    pub model: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub total_tokens: i64,
    pub request_count: i64,
}

#[derive(Debug, Serialize)]
pub struct TokenUsageResponse {
    pub data: Vec<DailyTokenUsage>,
    pub days: i32,
}

#[derive(Debug, Serialize)]
pub struct DailyLatency {
    pub day: String,
    pub tier: String,
    pub avg_ms: f64,
    pub p50_ms: f64,
    pub p95_ms: f64,
    pub request_count: i64,
}

#[derive(Debug, Serialize)]
pub struct LatencyResponse {
    pub data: Vec<DailyLatency>,
    pub days: i32,
}

#[derive(Debug, Serialize)]
pub struct ModelSuccessRate {
    pub model: String,
    pub total: i64,
    pub successes: i64,
    pub failures: i64,
    pub success_rate: f64,
}

#[derive(Debug, Serialize)]
pub struct SuccessRateResponse {
    pub data: Vec<ModelSuccessRate>,
    pub days: i32,
}

#[derive(Debug, Serialize)]
pub struct ToolUsageStat {
    pub tool_name: String,
    pub usage_count: i64,
    pub error_count: i64,
    pub avg_duration_ms: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct TopToolsResponse {
    pub data: Vec<ToolUsageStat>,
    pub days: i32,
    pub limit: i32,
}

#[derive(Debug, Serialize)]
pub struct CostBreakdown {
    pub model: String,
    pub tier: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub input_cost_usd: f64,
    pub output_cost_usd: f64,
    pub total_cost_usd: f64,
}

#[derive(Debug, Serialize)]
pub struct CostResponse {
    pub data: Vec<CostBreakdown>,
    pub total_cost_usd: f64,
    pub projected_monthly_usd: f64,
    pub days: i32,
}

// ── DB row types ────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct TokenRow {
    day: Option<DateTime<Utc>>,
    model: Option<String>,
    input_tokens: Option<i64>,
    output_tokens: Option<i64>,
    total_tokens: Option<i64>,
    request_count: Option<i64>,
}

#[derive(sqlx::FromRow)]
struct LatencyRow {
    day: Option<DateTime<Utc>>,
    tier: Option<String>,
    avg_ms: Option<f64>,
    p50_ms: Option<f64>,
    p95_ms: Option<f64>,
    request_count: Option<i64>,
}

#[derive(sqlx::FromRow)]
struct SuccessRow {
    model: Option<String>,
    total: Option<i64>,
    successes: Option<i64>,
    failures: Option<i64>,
}

#[derive(sqlx::FromRow)]
struct ToolRow {
    tool_name: Option<String>,
    usage_count: Option<i64>,
    error_count: Option<i64>,
}

#[derive(sqlx::FromRow)]
struct CostRow {
    model: Option<String>,
    tier: Option<String>,
    input_tokens: Option<i64>,
    output_tokens: Option<i64>,
}

// ── Helpers ─────────────────────────────────────────────────────────────

fn clamp_days(days: Option<i32>) -> i32 {
    days.unwrap_or(7).clamp(1, 90)
}

/// Determine pricing tier from model name.
fn model_tier(model: &str) -> &'static str {
    let m = model.to_lowercase();
    if m.contains("opus") {
        "opus"
    } else if m.contains("sonnet") {
        "sonnet"
    } else if m.contains("haiku") {
        "haiku"
    } else {
        "sonnet" // default fallback
    }
}

/// Per-million-token pricing: (input, output).
fn tier_pricing(tier: &str) -> (f64, f64) {
    match tier {
        "opus" => (15.0, 75.0),
        "sonnet" => (3.0, 15.0),
        "haiku" => (0.25, 1.25),
        _ => (3.0, 15.0),
    }
}

// ── Handlers ────────────────────────────────────────────────────────────

/// `GET /api/analytics/tokens?days=7` — daily token usage grouped by model + day
pub async fn analytics_tokens(
    State(state): State<AppState>,
    Query(q): Query<TimeRangeQuery>,
) -> Result<Json<TokenUsageResponse>, (StatusCode, Json<Value>)> {
    let days = clamp_days(q.days);

    let rows = sqlx::query_as::<_, TokenRow>(
        r#"
        SELECT
            date_trunc('day', created_at) AS day,
            model,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COUNT(*) AS request_count
        FROM ch_agent_usage
        WHERE created_at >= NOW() - make_interval(days => $1)
        GROUP BY date_trunc('day', created_at), model
        ORDER BY day ASC, model ASC
        "#,
    )
    .bind(days)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("analytics/tokens query failed: {e}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch token usage" })),
        )
    })?;

    let data = rows
        .into_iter()
        .map(|r| DailyTokenUsage {
            day: r
                .day
                .map(|d| d.format("%Y-%m-%d").to_string())
                .unwrap_or_default(),
            model: r.model.unwrap_or_default(),
            input_tokens: r.input_tokens.unwrap_or(0),
            output_tokens: r.output_tokens.unwrap_or(0),
            total_tokens: r.total_tokens.unwrap_or(0),
            request_count: r.request_count.unwrap_or(0),
        })
        .collect();

    Ok(Json(TokenUsageResponse { data, days }))
}

/// `GET /api/analytics/latency?days=7` — avg/p50/p95 latency per tier per day
pub async fn analytics_latency(
    State(state): State<AppState>,
    Query(q): Query<TimeRangeQuery>,
) -> Result<Json<LatencyResponse>, (StatusCode, Json<Value>)> {
    let days = clamp_days(q.days);

    let rows = sqlx::query_as::<_, LatencyRow>(
        r#"
        SELECT
            date_trunc('day', created_at) AS day,
            COALESCE(tier, 'unknown') AS tier,
            AVG(latency_ms) AS avg_ms,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms,
            COUNT(*) AS request_count
        FROM ch_agent_usage
        WHERE created_at >= NOW() - make_interval(days => $1)
          AND latency_ms > 0
        GROUP BY date_trunc('day', created_at), tier
        ORDER BY day ASC, tier ASC
        "#,
    )
    .bind(days)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("analytics/latency query failed: {e}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch latency data" })),
        )
    })?;

    let data = rows
        .into_iter()
        .map(|r| DailyLatency {
            day: r
                .day
                .map(|d| d.format("%Y-%m-%d").to_string())
                .unwrap_or_default(),
            tier: r.tier.unwrap_or_else(|| "unknown".to_string()),
            avg_ms: r.avg_ms.unwrap_or(0.0),
            p50_ms: r.p50_ms.unwrap_or(0.0),
            p95_ms: r.p95_ms.unwrap_or(0.0),
            request_count: r.request_count.unwrap_or(0),
        })
        .collect();

    Ok(Json(LatencyResponse { data, days }))
}

/// `GET /api/analytics/success-rate?days=7` — success/failure ratio per model
pub async fn analytics_success_rate(
    State(state): State<AppState>,
    Query(q): Query<TimeRangeQuery>,
) -> Result<Json<SuccessRateResponse>, (StatusCode, Json<Value>)> {
    let days = clamp_days(q.days);

    let rows = sqlx::query_as::<_, SuccessRow>(
        r#"
        SELECT
            model,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE success = TRUE) AS successes,
            COUNT(*) FILTER (WHERE success = FALSE) AS failures
        FROM ch_agent_usage
        WHERE created_at >= NOW() - make_interval(days => $1)
        GROUP BY model
        ORDER BY total DESC
        "#,
    )
    .bind(days)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("analytics/success-rate query failed: {e}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch success rates" })),
        )
    })?;

    let data = rows
        .into_iter()
        .map(|r| {
            let total = r.total.unwrap_or(0);
            let successes = r.successes.unwrap_or(0);
            let failures = r.failures.unwrap_or(0);
            let success_rate = if total > 0 {
                (successes as f64 / total as f64) * 100.0
            } else {
                0.0
            };
            ModelSuccessRate {
                model: r.model.unwrap_or_default(),
                total,
                successes,
                failures,
                success_rate,
            }
        })
        .collect();

    Ok(Json(SuccessRateResponse { data, days }))
}

/// `GET /api/analytics/top-tools?days=7&limit=10` — most used tools ranked by count
pub async fn analytics_top_tools(
    State(state): State<AppState>,
    Query(q): Query<TopToolsQuery>,
) -> Result<Json<TopToolsResponse>, (StatusCode, Json<Value>)> {
    let days = clamp_days(q.days);
    let limit = q.limit.unwrap_or(10).clamp(1, 50);

    let rows = sqlx::query_as::<_, ToolRow>(
        r#"
        SELECT
            tool_name,
            COUNT(*) AS usage_count,
            COUNT(*) FILTER (WHERE is_error = TRUE) AS error_count
        FROM ch_tool_interactions
        WHERE executed_at >= NOW() - make_interval(days => $1)
        GROUP BY tool_name
        ORDER BY usage_count DESC
        LIMIT $2
        "#,
    )
    .bind(days)
    .bind(limit as i64)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("analytics/top-tools query failed: {e}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch top tools" })),
        )
    })?;

    let data = rows
        .into_iter()
        .map(|r| ToolUsageStat {
            tool_name: r.tool_name.unwrap_or_default(),
            usage_count: r.usage_count.unwrap_or(0),
            error_count: r.error_count.unwrap_or(0),
            avg_duration_ms: None, // ch_tool_interactions doesn't have duration_ms
        })
        .collect();

    Ok(Json(TopToolsResponse { data, days, limit }))
}

/// `GET /api/analytics/cost?days=30` — estimated cost based on token usage + model pricing
pub async fn analytics_cost(
    State(state): State<AppState>,
    Query(q): Query<TimeRangeQuery>,
) -> Result<Json<CostResponse>, (StatusCode, Json<Value>)> {
    let days = clamp_days(q.days);

    let rows = sqlx::query_as::<_, CostRow>(
        r#"
        SELECT
            model,
            tier,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens
        FROM ch_agent_usage
        WHERE created_at >= NOW() - make_interval(days => $1)
        GROUP BY model, tier
        ORDER BY model ASC
        "#,
    )
    .bind(days)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("analytics/cost query failed: {e}");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch cost data" })),
        )
    })?;

    let data: Vec<CostBreakdown> = rows
        .into_iter()
        .map(|r| {
            let model = r.model.unwrap_or_default();
            let tier = r
                .tier
                .clone()
                .unwrap_or_else(|| model_tier(&model).to_string());
            let input_tokens = r.input_tokens.unwrap_or(0);
            let output_tokens = r.output_tokens.unwrap_or(0);

            let (input_price, output_price) = tier_pricing(&tier);
            let input_cost = (input_tokens as f64 / 1_000_000.0) * input_price;
            let output_cost = (output_tokens as f64 / 1_000_000.0) * output_price;

            CostBreakdown {
                model,
                tier,
                input_tokens,
                output_tokens,
                input_cost_usd: (input_cost * 100.0).round() / 100.0,
                output_cost_usd: (output_cost * 100.0).round() / 100.0,
                total_cost_usd: ((input_cost + output_cost) * 100.0).round() / 100.0,
            }
        })
        .collect();

    let total_cost: f64 = data.iter().map(|d| d.total_cost_usd).sum();
    let projected_monthly = if days > 0 {
        (total_cost / days as f64) * 30.0
    } else {
        0.0
    };

    Ok(Json(CostResponse {
        data,
        total_cost_usd: (total_cost * 100.0).round() / 100.0,
        projected_monthly_usd: (projected_monthly * 100.0).round() / 100.0,
        days,
    }))
}
