// Jaskier Shared Pattern — Vercel Tools
// Adapter: tool definitions are local (use crate::models::ToolDefinition),
// execution delegates to jaskier_tools::tools::vercel_tools.

use serde_json::{Value, json};

use crate::models::ToolDefinition;
use crate::state::AppState;

// ═══════════════════════════════════════════════════════════════════════
//  Tool definitions (local — uses crate::models::ToolDefinition)
// ═══════════════════════════════════════════════════════════════════════

pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "vercel_list_projects".to_string(),
            description: "List Vercel projects for the authenticated user/team. \
                Returns project names, frameworks, and latest deployments."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Max results (default: 20, max: 100)"
                    }
                },
                "required": []
            }),
        },
        ToolDefinition {
            name: "vercel_get_deployment".to_string(),
            description: "Get details about a specific Vercel deployment by ID or URL.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "deployment_id": {
                        "type": "string",
                        "description": "Deployment ID or URL"
                    }
                },
                "required": ["deployment_id"]
            }),
        },
        ToolDefinition {
            name: "vercel_deploy".to_string(),
            description: "Trigger a new deployment for a Vercel project. \
                Creates a deployment from the latest git commit."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "project": {
                        "type": "string",
                        "description": "Project name or ID"
                    },
                    "target": {
                        "type": "string",
                        "description": "Deployment target: production or preview (default: preview)"
                    }
                },
                "required": ["project"]
            }),
        },
    ]
}

// ═══════════════════════════════════════════════════════════════════════
//  Tool execution — delegates to shared jaskier-tools crate
// ═══════════════════════════════════════════════════════════════════════

pub async fn execute(tool_name: &str, input: &Value, state: &AppState) -> (String, bool) {
    match jaskier_tools::tools::vercel_tools::execute(
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
