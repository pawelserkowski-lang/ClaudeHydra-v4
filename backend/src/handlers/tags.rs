//! Session tagging & full-text search across messages.
//!
//! Endpoints:
//! - `GET  /api/sessions/{id}/tags`          — list tags for a session
//! - `POST /api/sessions/{id}/tags`          — add tag(s) to a session
//! - `DELETE /api/sessions/{id}/tags/{tag}`  — remove a tag from a session
//! - `GET  /api/sessions/search`             — full-text search + tag filter

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use utoipa::ToSchema;

use crate::state::AppState;

// ── Request / Response types ────────────────────────────────────────────────

/// Request body for adding tags to a session.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct AddTagsRequest {
    pub tags: Vec<String>,
}

/// A single tag row returned from the database.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct TagRow {
    pub tag: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Query parameters for the search endpoint.
#[derive(Debug, Clone, Deserialize)]
pub struct SearchParams {
    /// Full-text search query (optional).
    pub q: Option<String>,
    /// Comma-separated list of tags to filter by (optional).
    pub tags: Option<String>,
    /// Maximum number of results (default 50, max 200).
    pub limit: Option<i64>,
    /// Offset for pagination (default 0).
    pub offset: Option<i64>,
}

/// A search result item — a session with matched context.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SearchResult {
    pub session_id: String,
    pub session_title: String,
    pub message_id: Option<String>,
    pub message_preview: Option<String>,
    pub message_role: Option<String>,
    pub message_timestamp: Option<String>,
    pub tags: Vec<String>,
    pub rank: Option<f32>,
}

/// Row type for the search query.
#[derive(Debug, Clone, sqlx::FromRow)]
struct SearchRow {
    session_id: uuid::Uuid,
    session_title: String,
    message_id: Option<uuid::Uuid>,
    message_preview: Option<String>,
    message_role: Option<String>,
    message_timestamp: Option<chrono::DateTime<chrono::Utc>>,
    rank: Option<f32>,
}

// ── GET /api/sessions/{id}/tags ─────────────────────────────────────────────

#[utoipa::path(get, path = "/api/sessions/{id}/tags", tag = "tags",
    params(("id" = String, Path, description = "Session UUID")),
    responses((status = 200, description = "Tags for session")))]
pub async fn get_session_tags(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let session_id: uuid::Uuid = id.parse().map_err(|_| StatusCode::BAD_REQUEST)?;

    // Verify session exists
    sqlx::query("SELECT 1 FROM ch_sessions WHERE id = $1")
        .bind(session_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let tags = sqlx::query_as::<_, TagRow>(
        "SELECT tag, created_at FROM ch_session_tags WHERE session_id = $1 ORDER BY tag ASC",
    )
    .bind(session_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get session tags: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!({
        "session_id": id,
        "tags": tags.iter().map(|t| &t.tag).collect::<Vec<_>>(),
    })))
}

// ── POST /api/sessions/{id}/tags ────────────────────────────────────────────

#[utoipa::path(post, path = "/api/sessions/{id}/tags", tag = "tags",
    params(("id" = String, Path, description = "Session UUID")),
    request_body = AddTagsRequest,
    responses((status = 200, description = "Tags added")))]
pub async fn add_session_tags(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<AddTagsRequest>,
) -> Result<Json<Value>, StatusCode> {
    let session_id: uuid::Uuid = id.parse().map_err(|_| StatusCode::BAD_REQUEST)?;

    // Verify session exists
    sqlx::query("SELECT 1 FROM ch_sessions WHERE id = $1")
        .bind(session_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Validate tags
    let tags: Vec<String> = req
        .tags
        .into_iter()
        .map(|t| t.trim().to_lowercase())
        .filter(|t| !t.is_empty() && t.len() <= 50)
        .collect();

    if tags.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Insert tags (ON CONFLICT DO NOTHING for idempotency)
    for tag in &tags {
        sqlx::query(
            "INSERT INTO ch_session_tags (session_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(session_id)
        .bind(tag)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to add tag '{}': {}", tag, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    // Return current tags
    let all_tags: Vec<String> =
        sqlx::query_scalar("SELECT tag FROM ch_session_tags WHERE session_id = $1 ORDER BY tag ASC")
            .bind(session_id)
            .fetch_all(&state.db)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch tags: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(json!({
        "session_id": id,
        "tags": all_tags,
    })))
}

// ── DELETE /api/sessions/{id}/tags/{tag} ────────────────────────────────────

#[utoipa::path(delete, path = "/api/sessions/{id}/tags/{tag}", tag = "tags",
    params(
        ("id" = String, Path, description = "Session UUID"),
        ("tag" = String, Path, description = "Tag to remove"),
    ),
    responses((status = 200, description = "Tag removed")))]
pub async fn delete_session_tag(
    State(state): State<AppState>,
    Path((id, tag)): Path<(String, String)>,
) -> Result<Json<Value>, StatusCode> {
    let session_id: uuid::Uuid = id.parse().map_err(|_| StatusCode::BAD_REQUEST)?;
    let tag = tag.trim().to_lowercase();

    let result = sqlx::query(
        "DELETE FROM ch_session_tags WHERE session_id = $1 AND tag = $2",
    )
    .bind(session_id)
    .bind(&tag)
    .execute(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to delete tag: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(Json(json!({
        "session_id": id,
        "removed": tag,
    })))
}

// ── GET /api/sessions/search ────────────────────────────────────────────────

#[utoipa::path(get, path = "/api/sessions/search", tag = "tags",
    params(
        ("q" = Option<String>, Query, description = "Full-text search query"),
        ("tags" = Option<String>, Query, description = "Comma-separated tag filter"),
        ("limit" = Option<i64>, Query, description = "Max results (default 50)"),
        ("offset" = Option<i64>, Query, description = "Pagination offset"),
    ),
    responses((status = 200, description = "Search results")))]
pub async fn search_sessions(
    State(state): State<AppState>,
    Query(params): Query<SearchParams>,
) -> Result<Json<Value>, StatusCode> {
    let limit = params.limit.unwrap_or(50).clamp(1, 200);
    let offset = params.offset.unwrap_or(0).max(0);

    let tag_filter: Vec<String> = params
        .tags
        .as_deref()
        .unwrap_or("")
        .split(',')
        .map(|t| t.trim().to_lowercase())
        .filter(|t| !t.is_empty())
        .collect();

    let has_query = params.q.as_ref().is_some_and(|q| !q.trim().is_empty());
    let has_tags = !tag_filter.is_empty();

    // Build dynamic query based on presence of q and tags
    let results = if has_query {
        let query_text = params.q.as_deref().unwrap_or("").trim();

        // Convert user query to tsquery — use plainto_tsquery for robustness
        if has_tags {
            // Full-text search + tag filter
            sqlx::query_as::<_, SearchRow>(
                "SELECT DISTINCT ON (s.id, m.id) \
                    s.id AS session_id, s.title AS session_title, \
                    m.id AS message_id, \
                    LEFT(m.content, 200) AS message_preview, \
                    m.role AS message_role, \
                    m.created_at AS message_timestamp, \
                    ts_rank(m.search_vector, plainto_tsquery('english', $1)) AS rank \
                FROM ch_messages m \
                JOIN ch_sessions s ON s.id = m.session_id \
                JOIN ch_session_tags t ON t.session_id = s.id \
                WHERE m.search_vector @@ plainto_tsquery('english', $1) \
                    AND t.tag = ANY($2) \
                ORDER BY s.id, m.id, rank DESC \
                LIMIT $3 OFFSET $4",
            )
            .bind(query_text)
            .bind(&tag_filter)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        } else {
            // Full-text search only (no tag filter)
            sqlx::query_as::<_, SearchRow>(
                "SELECT \
                    s.id AS session_id, s.title AS session_title, \
                    m.id AS message_id, \
                    LEFT(m.content, 200) AS message_preview, \
                    m.role AS message_role, \
                    m.created_at AS message_timestamp, \
                    ts_rank(m.search_vector, plainto_tsquery('english', $1)) AS rank \
                FROM ch_messages m \
                JOIN ch_sessions s ON s.id = m.session_id \
                WHERE m.search_vector @@ plainto_tsquery('english', $1) \
                ORDER BY rank DESC \
                LIMIT $2 OFFSET $3",
            )
            .bind(query_text)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        }
    } else if has_tags {
        // Tag filter only (no full-text search) — return sessions matching tags
        sqlx::query_as::<_, SearchRow>(
            "SELECT DISTINCT ON (s.id) \
                s.id AS session_id, s.title AS session_title, \
                NULL::UUID AS message_id, \
                NULL::TEXT AS message_preview, \
                NULL::TEXT AS message_role, \
                NULL::TIMESTAMPTZ AS message_timestamp, \
                NULL::REAL AS rank \
            FROM ch_sessions s \
            JOIN ch_session_tags t ON t.session_id = s.id \
            WHERE t.tag = ANY($1) \
            ORDER BY s.id, s.updated_at DESC \
            LIMIT $2 OFFSET $3",
        )
        .bind(&tag_filter)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    } else {
        // No query and no tags — return empty results
        return Ok(Json(json!({
            "results": [],
            "total": 0,
            "query": null,
            "tags": [],
        })));
    }
    .map_err(|e| {
        tracing::error!("Search query failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Collect unique session IDs to fetch their tags
    let session_ids: Vec<uuid::Uuid> = results
        .iter()
        .map(|r| r.session_id)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    let session_tags: Vec<(uuid::Uuid, String)> = if session_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, (uuid::Uuid, String)>(
            "SELECT session_id, tag FROM ch_session_tags WHERE session_id = ANY($1) ORDER BY tag ASC",
        )
        .bind(&session_ids)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
    };

    // Group tags by session_id
    let mut tags_map: std::collections::HashMap<uuid::Uuid, Vec<String>> =
        std::collections::HashMap::new();
    for (sid, tag) in session_tags {
        tags_map.entry(sid).or_default().push(tag);
    }

    let search_results: Vec<SearchResult> = results
        .into_iter()
        .map(|r| SearchResult {
            session_id: r.session_id.to_string(),
            session_title: r.session_title,
            message_id: r.message_id.map(|id| id.to_string()),
            message_preview: r.message_preview,
            message_role: r.message_role,
            message_timestamp: r.message_timestamp.map(|t| t.to_rfc3339()),
            tags: tags_map
                .get(&r.session_id)
                .cloned()
                .unwrap_or_default(),
            rank: r.rank,
        })
        .collect();

    let total = search_results.len();

    Ok(Json(json!({
        "results": search_results,
        "total": total,
        "query": params.q,
        "tags": tag_filter,
    })))
}

// ── GET /api/tags — list all unique tags with counts ────────────────────────

#[utoipa::path(get, path = "/api/tags", tag = "tags",
    responses((status = 200, description = "All unique tags with counts")))]
pub async fn list_all_tags(
    State(state): State<AppState>,
) -> Result<Json<Value>, StatusCode> {
    let tags: Vec<(String, i64)> = sqlx::query_as(
        "SELECT tag, COUNT(*) as count FROM ch_session_tags GROUP BY tag ORDER BY count DESC, tag ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list tags: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let tag_list: Vec<Value> = tags
        .into_iter()
        .map(|(tag, count)| json!({ "tag": tag, "count": count }))
        .collect();

    Ok(Json(json!({
        "tags": tag_list,
    })))
}
