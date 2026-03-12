// Jaskier Shared Pattern — Fly.io Tools
// Adapter: tool definitions are local (use crate::models::ToolDefinition),
// execution delegates to jaskier_tools::tools::fly_tools.

use serde_json::{Value, json};

use crate::models::ToolDefinition;
use crate::state::AppState;

// ═══════════════════════════════════════════════════════════════════════
//  Tool definitions (local — uses crate::models::ToolDefinition)
// ═══════════════════════════════════════════════════════════════════════

pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "fly_list_apps".to_string(),
            description: "List Fly.io applications for the authenticated user. \
                Returns app names, status, and organization."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "org_slug": {
                        "type": "string",
                        "description": "Organization slug to filter by (default: personal)"
                    }
                },
                "required": []
            }),
        },
        ToolDefinition {
            name: "fly_get_status".to_string(),
            description: "Get the status of a specific Fly.io application, including \
                machine states, regions, and health checks."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "app_name": {
                        "type": "string",
                        "description": "Name of the Fly.io application"
                    }
                },
                "required": ["app_name"]
            }),
        },
        ToolDefinition {
            name: "fly_get_logs".to_string(),
            description: "Get recent logs for a Fly.io application. Returns the last \
                N log entries."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "app_name": {
                        "type": "string",
                        "description": "Name of the Fly.io application"
                    }
                },
                "required": ["app_name"]
            }),
        },
    ]
}

// ═══════════════════════════════════════════════════════════════════════
//  Tool execution — delegates to shared jaskier-tools crate
// ═══════════════════════════════════════════════════════════════════════

pub async fn execute(tool_name: &str, input: &Value, state: &AppState) -> (String, bool) {
    match jaskier_tools::tools::fly_tools::execute(
        tool_name,
        input,
        state,
        &state.http_client,
    )
    .await
    {
        Ok(result) => (result, false),
        Err(e) => (e, true),
    }
}
