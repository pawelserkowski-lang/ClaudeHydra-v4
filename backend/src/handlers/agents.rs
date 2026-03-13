//! Agent listing, refresh, CRUD management, and delegation monitoring endpoints.

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use futures_util::stream::Stream;
use serde_json::{Value, json};
use std::convert::Infallible;

use crate::models::{AgentConfigRow, CreateAgentRequest, UpdateAgentRequest, WitcherAgent};
use crate::state::AppState;

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/agents — list all agents (from in-memory cache)
// ═══════════════════════════════════════════════════════════════════════

#[utoipa::path(
    get,
    path = "/api/agents",
    tag = "agents",
    responses((status = 200, description = "List of Witcher agents"))
)]
pub async fn list_agents(State(state): State<AppState>) -> Json<Value> {
    let agents = state.agents.read().await;
    Json(
        serde_json::to_value(&*agents).unwrap_or_else(|_| json!({"error": "serialization failed"})),
    )
}

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/agents/{id} — get single agent by ID
// ═══════════════════════════════════════════════════════════════════════

#[utoipa::path(
    get,
    path = "/api/agents/{id}",
    tag = "agents",
    params(("id" = String, Path, description = "Agent ID")),
    responses(
        (status = 200, description = "Agent details"),
        (status = 404, description = "Agent not found")
    )
)]
pub async fn get_agent(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row: Option<AgentConfigRow> = sqlx::query_as(
        "SELECT id, name, role, tier, status, description, model, created_at, updated_at \
         FROM ch_agents_config WHERE id = $1",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("get_agent DB error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to load agent" })),
        )
    })?;

    match row {
        Some(agent) => {
            let wa: WitcherAgent = agent.into();
            Ok(Json(serde_json::to_value(wa).unwrap_or_else(|_| json!({}))))
        }
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("Agent '{}' not found", id) })),
        )),
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/agents — create a new agent
// ═══════════════════════════════════════════════════════════════════════

#[utoipa::path(
    post,
    path = "/api/agents",
    tag = "agents",
    request_body = CreateAgentRequest,
    responses(
        (status = 201, description = "Agent created"),
        (status = 400, description = "Invalid request"),
        (status = 409, description = "Agent name already exists")
    )
)]
pub async fn create_agent(
    State(state): State<AppState>,
    Json(req): Json<CreateAgentRequest>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    // Validate tier
    if !["Commander", "Coordinator", "Executor"].contains(&req.tier.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "tier must be one of: Commander, Coordinator, Executor" })),
        ));
    }

    // Validate name not empty
    let name = req.name.trim().to_string();
    if name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "name must not be empty" })),
        ));
    }

    // Generate next sequential ID
    let next_id = {
        let max_row: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM ch_agents_config ORDER BY id DESC LIMIT 1",
        )
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

        if let Some((max_id,)) = max_row {
            // Parse numeric suffix, e.g. "agent-012" → 12
            let num: i32 = max_id
                .strip_prefix("agent-")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);
            format!("agent-{:03}", num + 1)
        } else {
            "agent-001".to_string()
        }
    };

    // Resolve model — use provided or derive from tier
    let model = if req.model.is_empty() {
        match req.tier.as_str() {
            "Commander" => "claude-opus-4-6",
            "Coordinator" => "claude-sonnet-4-6",
            "Executor" => "claude-haiku-4-5-20251001",
            _ => "claude-sonnet-4-6",
        }
        .to_string()
    } else {
        req.model
    };

    let row: Result<AgentConfigRow, _> = sqlx::query_as(
        "INSERT INTO ch_agents_config (id, name, role, tier, status, description, model) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING id, name, role, tier, status, description, model, created_at, updated_at",
    )
    .bind(&next_id)
    .bind(&name)
    .bind(&req.role)
    .bind(&req.tier)
    .bind(&req.status)
    .bind(&req.description)
    .bind(&model)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(agent) => {
            let wa: WitcherAgent = agent.into();
            // Refresh in-memory cache
            state.refresh_agents().await;
            tracing::info!("Agent created: {} ({})", wa.name, wa.id);
            Ok((
                StatusCode::CREATED,
                Json(serde_json::to_value(wa).unwrap_or_else(|_| json!({}))),
            ))
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("duplicate key") || msg.contains("unique constraint") {
                Err((
                    StatusCode::CONFLICT,
                    Json(json!({ "error": format!("Agent name '{}' already exists", name) })),
                ))
            } else {
                tracing::error!("create_agent DB error: {}", e);
                Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Failed to create agent" })),
                ))
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  PUT /api/agents/{id} — update an existing agent
// ═══════════════════════════════════════════════════════════════════════

#[utoipa::path(
    put,
    path = "/api/agents/{id}",
    tag = "agents",
    params(("id" = String, Path, description = "Agent ID")),
    request_body = UpdateAgentRequest,
    responses(
        (status = 200, description = "Agent updated"),
        (status = 404, description = "Agent not found"),
        (status = 400, description = "Invalid request")
    )
)]
pub async fn update_agent(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<UpdateAgentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Validate tier if provided
    if let Some(ref tier) = req.tier {
        if !["Commander", "Coordinator", "Executor"].contains(&tier.as_str()) {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "tier must be one of: Commander, Coordinator, Executor" })),
            ));
        }
    }

    // Validate name if provided
    if let Some(ref name) = req.name {
        if name.trim().is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "name must not be empty" })),
            ));
        }
    }

    // Use COALESCE pattern: only update fields that are provided (non-null)
    let row: Option<AgentConfigRow> = sqlx::query_as(
        "UPDATE ch_agents_config SET \
            name = COALESCE($2, name), \
            role = COALESCE($3, role), \
            tier = COALESCE($4, tier), \
            status = COALESCE($5, status), \
            description = COALESCE($6, description), \
            model = COALESCE($7, model), \
            updated_at = now() \
         WHERE id = $1 \
         RETURNING id, name, role, tier, status, description, model, created_at, updated_at",
    )
    .bind(&id)
    .bind(&req.name)
    .bind(&req.role)
    .bind(&req.tier)
    .bind(&req.status)
    .bind(&req.description)
    .bind(&req.model)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        let msg = e.to_string();
        if msg.contains("duplicate key") || msg.contains("unique constraint") {
            (
                StatusCode::CONFLICT,
                Json(json!({ "error": "Agent name already exists" })),
            )
        } else if msg.contains("check constraint") {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "tier must be one of: Commander, Coordinator, Executor" })),
            )
        } else {
            tracing::error!("update_agent DB error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to update agent" })),
            )
        }
    })?;

    match row {
        Some(agent) => {
            let wa: WitcherAgent = agent.into();
            // Refresh in-memory cache
            state.refresh_agents().await;
            tracing::info!("Agent updated: {} ({})", wa.name, wa.id);
            Ok(Json(serde_json::to_value(wa).unwrap_or_else(|_| json!({}))))
        }
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("Agent '{}' not found", id) })),
        )),
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  DELETE /api/agents/{id} — delete an agent
// ═══════════════════════════════════════════════════════════════════════

#[utoipa::path(
    delete,
    path = "/api/agents/{id}",
    tag = "agents",
    params(("id" = String, Path, description = "Agent ID")),
    responses(
        (status = 200, description = "Agent deleted"),
        (status = 404, description = "Agent not found")
    )
)]
pub async fn delete_agent(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let result = sqlx::query("DELETE FROM ch_agents_config WHERE id = $1")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("delete_agent DB error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to delete agent" })),
            )
        })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("Agent '{}' not found", id) })),
        ));
    }

    // Refresh in-memory cache
    state.refresh_agents().await;
    tracing::info!("Agent deleted: {}", id);

    Ok(Json(json!({
        "status": "deleted",
        "id": id,
    })))
}

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/agents/refresh — reload agents from DB
// ═══════════════════════════════════════════════════════════════════════

pub async fn refresh_agents(State(state): State<AppState>) -> Json<Value> {
    state.refresh_agents().await;
    let agents = state.agents.read().await;
    Json(json!({
        "status": "refreshed",
        "count": agents.len(),
    }))
}

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/agents/delegations — A2A delegation monitoring
// ═══════════════════════════════════════════════════════════════════════

type A2aTaskRow = (
    uuid::Uuid,
    String,
    String,
    String,
    String,
    String,
    Option<String>,
    i32,
    Option<i32>,
    bool,
    chrono::DateTime<chrono::Utc>,
    Option<chrono::DateTime<chrono::Utc>>,
);

#[utoipa::path(
    get,
    path = "/api/agents/delegations",
    tag = "agents",
    responses((status = 200, description = "Recent agent-to-agent delegations"))
)]
pub async fn list_delegations(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let rows: Vec<A2aTaskRow> = sqlx::query_as(
        "SELECT id, agent_name, agent_tier, task_prompt, model_used, status, \
         result_preview, call_depth, duration_ms, is_error, created_at, completed_at \
         FROM ch_a2a_tasks ORDER BY created_at DESC LIMIT 50",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("list_delegations DB error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to load delegations" })),
        )
    })?;

    let tasks: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.0.to_string(),
                "agent_name": r.1,
                "agent_tier": r.2,
                "task_prompt": r.3,
                "model_used": r.4,
                "status": r.5,
                "result_preview": r.6,
                "call_depth": r.7,
                "duration_ms": r.8,
                "is_error": r.9,
                "created_at": r.10.to_rfc3339(),
                "completed_at": r.11.map(|t| t.to_rfc3339()),
            })
        })
        .collect();

    // Stats summary
    let stats_row: Option<(i64, i64, i64, Option<f64>)> = sqlx::query_as(
        "SELECT COUNT(*), \
         COUNT(*) FILTER (WHERE status = 'completed'), \
         COUNT(*) FILTER (WHERE is_error = TRUE), \
         AVG(duration_ms)::float8 \
         FROM ch_a2a_tasks",
    )
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let (total, completed, errors, avg_ms) = stats_row.unwrap_or((0, 0, 0, None));

    Ok(Json(json!({
        "tasks": tasks,
        "stats": {
            "total": total,
            "completed": completed,
            "errors": errors,
            "avg_duration_ms": avg_ms.map(|v| v as i64),
        }
    })))
}

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/agents/delegations/stream — A2A real-time SSE stream
// ═══════════════════════════════════════════════════════════════════════

#[utoipa::path(
    get,
    path = "/api/agents/delegations/stream",
    tag = "agents",
    responses((status = 200, description = "SSE stream of agent-to-agent delegations"))
)]
pub async fn delegations_stream(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut rx = state.a2a_task_tx.subscribe();

    let stream = async_stream::stream! {
        while let Ok(msg) = rx.recv().await {
            if let Ok(event) = Event::default().json_data(msg) {
                yield Ok(event);
            }
        }
    };

    Sse::new(stream).keep_alive(KeepAlive::new())
}
