// Jaskier Shared Pattern -- mcp/server
//! MCP Server endpoint — exposes ClaudeHydra tools and resources via JSON-RPC 2.0.
//!
//! External MCP clients can connect to `POST /mcp` to discover and call CH tools,
//! and read CH resources (agents, sessions, system stats).

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde_json::{Value, json};

use crate::state::AppState;

// ── Constants ────────────────────────────────────────────────────────────

const MCP_PROTOCOL_VERSION: &str = "2025-03-26";
const MCP_SERVER_NAME: &str = "ClaudeHydra";
const MCP_SERVER_VERSION: &str = "4.0.0";

/// Per-tool timeout when executing via MCP server endpoint (seconds).
const MCP_TOOL_TIMEOUT_SECS: u64 = 30;

// ── Main Handler ─────────────────────────────────────────────────────────

/// POST /mcp — MCP Server JSON-RPC 2.0 handler.
///
/// Supports:
/// - `initialize` — handshake
/// - `notifications/initialized` — client ready notification
/// - `tools/list` — list all CH tools
/// - `tools/call` — execute a CH tool
/// - `resources/list` — list available resources
/// - `resources/read` — read a resource by URI
/// - `ping` — health check
pub async fn mcp_handler(
    State(state): State<AppState>,
    Json(request): Json<Value>,
) -> impl IntoResponse {
    let method = request.get("method").and_then(|v| v.as_str()).unwrap_or("");
    let id = request.get("id").cloned();
    let params = request.get("params").cloned().unwrap_or(json!({}));

    tracing::debug!("mcp_server: method={}, id={:?}", method, id);

    let result = match method {
        "initialize" => handle_initialize(&params),
        "notifications/initialized" => {
            // Notification — no response needed (but we return empty for simplicity)
            return (StatusCode::OK, Json(json!(null)));
        }
        "tools/list" => handle_tools_list(&state).await,
        "tools/call" => handle_tools_call(&state, &params).await,
        "resources/list" => handle_resources_list(),
        "resources/read" => handle_resources_read(&state, &params).await,
        "ping" => Ok(json!({})),
        _ => Err(json_rpc_error_body(-32601, "Method not found")),
    };

    let response = match result {
        Ok(result_value) => {
            if let Some(id) = id {
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": result_value,
                })
            } else {
                // Notification response (no id)
                json!(null)
            }
        }
        Err(error_value) => {
            if let Some(id) = id {
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": error_value,
                })
            } else {
                json!(null)
            }
        }
    };

    (StatusCode::OK, Json(response))
}

// ── Method Handlers ──────────────────────────────────────────────────────

fn handle_initialize(_params: &Value) -> Result<Value, Value> {
    Ok(json!({
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "capabilities": {
            "tools": { "listChanged": false },
            "resources": { "subscribe": false, "listChanged": false },
        },
        "serverInfo": {
            "name": MCP_SERVER_NAME,
            "version": MCP_SERVER_VERSION,
        },
    }))
}

async fn handle_tools_list(state: &AppState) -> Result<Value, Value> {
    let defs = state.tool_executor.tool_definitions();

    let tools: Vec<Value> = defs
        .into_iter()
        .map(|td| {
            json!({
                "name": td.name,
                "description": td.description,
                "inputSchema": td.input_schema,
            })
        })
        .collect();

    Ok(json!({ "tools": tools }))
}

async fn handle_tools_call(state: &AppState, params: &Value) -> Result<Value, Value> {
    let tool_name = params
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| json_rpc_error_body(-32602, "Missing 'name' parameter"))?;

    let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

    tracing::info!("mcp_server: tools/call name={}", tool_name);

    // Read working_directory from settings for tool path resolution
    let wd: String = sqlx::query_scalar("SELECT working_directory FROM ch_settings WHERE id = 1")
        .fetch_one(&state.db)
        .await
        .unwrap_or_default();
    let executor = state.tool_executor.with_working_directory(&wd);

    let timeout = std::time::Duration::from_secs(MCP_TOOL_TIMEOUT_SECS);
    let (result, is_error) = match tokio::time::timeout(
        timeout,
        executor.execute_with_state(tool_name, &arguments, state),
    )
    .await
    {
        Ok(r) => r,
        Err(_) => (
            format!(
                "Tool '{}' timed out after {}s",
                tool_name, MCP_TOOL_TIMEOUT_SECS
            ),
            true,
        ),
    };

    Ok(json!({
        "content": [{
            "type": "text",
            "text": result,
        }],
        "isError": is_error,
    }))
}

fn handle_resources_list() -> Result<Value, Value> {
    Ok(json!({
        "resources": [
            {
                "uri": "claudehydra://agents",
                "name": "Witcher Agents",
                "description": "List of all ClaudeHydra Witcher agents with roles, tiers, and models",
                "mimeType": "application/json",
            },
            {
                "uri": "claudehydra://sessions",
                "name": "Chat Sessions",
                "description": "List of all chat session summaries (id, title, message count)",
                "mimeType": "application/json",
            },
            {
                "uri": "claudehydra://system",
                "name": "System Stats",
                "description": "Current system statistics (CPU, memory, uptime, platform)",
                "mimeType": "application/json",
            },
        ],
    }))
}

async fn handle_resources_read(state: &AppState, params: &Value) -> Result<Value, Value> {
    let uri = params
        .get("uri")
        .and_then(|v| v.as_str())
        .ok_or_else(|| json_rpc_error_body(-32602, "Missing 'uri' parameter"))?;

    match uri {
        "claudehydra://agents" => {
            let agents = state.agents.read().await;
            let agents_json = serde_json::to_value(&*agents).unwrap_or_else(|_| json!([]));
            Ok(json!({
                "contents": [{
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": serde_json::to_string_pretty(&agents_json)
                        .unwrap_or_else(|_| "[]".to_string()),
                }],
            }))
        }
        "claudehydra://sessions" => {
            let sessions = sqlx::query_as::<_, crate::models::SessionSummaryRow>(
                "SELECT s.id, s.title, s.created_at, COUNT(m.id) AS message_count \
                 FROM ch_sessions s LEFT JOIN ch_messages m ON m.session_id = s.id \
                 GROUP BY s.id ORDER BY s.updated_at DESC LIMIT 100",
            )
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();

            let sessions_json: Vec<Value> = sessions
                .into_iter()
                .map(|s| {
                    json!({
                        "id": s.id.to_string(),
                        "title": s.title,
                        "created_at": s.created_at.to_rfc3339(),
                        "message_count": s.message_count,
                    })
                })
                .collect();

            Ok(json!({
                "contents": [{
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": serde_json::to_string_pretty(&sessions_json)
                        .unwrap_or_else(|_| "[]".to_string()),
                }],
            }))
        }
        "claudehydra://system" => {
            let snap = state.system_monitor.read().await;
            let uptime = state.start_time.elapsed().as_secs();
            let stats = json!({
                "cpu_usage_percent": snap.cpu_usage_percent,
                "memory_used_mb": snap.memory_used_mb,
                "memory_total_mb": snap.memory_total_mb,
                "platform": snap.platform,
                "uptime_seconds": uptime,
                "ready": state.is_ready(),
            });
            drop(snap);

            Ok(json!({
                "contents": [{
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": serde_json::to_string_pretty(&stats)
                        .unwrap_or_else(|_| "{}".to_string()),
                }],
            }))
        }
        _ => Err(json_rpc_error_body(
            -32602,
            &format!("Unknown resource URI: {}", uri),
        )),
    }
}

// ── JSON-RPC Error Helper ────────────────────────────────────────────────

fn json_rpc_error_body(code: i32, message: &str) -> Value {
    json!({
        "code": code,
        "message": message,
    })
}
