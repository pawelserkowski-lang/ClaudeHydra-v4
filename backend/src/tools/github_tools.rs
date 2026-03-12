// Jaskier Shared Pattern — GitHub Tools
// Adapter: tool definitions are local (use crate::models::ToolDefinition),
// execution delegates to jaskier_tools::tools::github_tools.

use serde_json::{Value, json};

use crate::models::ToolDefinition;
use crate::state::AppState;

// ═══════════════════════════════════════════════════════════════════════
//  Tool definitions (local — uses crate::models::ToolDefinition)
// ═══════════════════════════════════════════════════════════════════════

pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "github_list_repos".to_string(),
            description: "List GitHub repositories for the authenticated user. \
                Returns name, description, language, stars, and visibility."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "sort": {
                        "type": "string",
                        "description": "Sort by: created, updated, pushed, full_name (default: updated)"
                    },
                    "per_page": {
                        "type": "integer",
                        "description": "Results per page, max 100 (default: 30)"
                    }
                },
                "required": []
            }),
        },
        ToolDefinition {
            name: "github_get_repo".to_string(),
            description: "Get detailed information about a specific GitHub repository.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "owner": {
                        "type": "string",
                        "description": "Repository owner (user or org)"
                    },
                    "repo": {
                        "type": "string",
                        "description": "Repository name"
                    }
                },
                "required": ["owner", "repo"]
            }),
        },
        ToolDefinition {
            name: "github_list_issues".to_string(),
            description: "List issues for a GitHub repository. Supports filtering by state."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "owner": {
                        "type": "string",
                        "description": "Repository owner"
                    },
                    "repo": {
                        "type": "string",
                        "description": "Repository name"
                    },
                    "state": {
                        "type": "string",
                        "description": "Filter by state: open, closed, all (default: open)"
                    }
                },
                "required": ["owner", "repo"]
            }),
        },
        ToolDefinition {
            name: "github_get_issue".to_string(),
            description: "Get a specific GitHub issue with its comments.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "owner": {
                        "type": "string",
                        "description": "Repository owner"
                    },
                    "repo": {
                        "type": "string",
                        "description": "Repository name"
                    },
                    "number": {
                        "type": "integer",
                        "description": "Issue number"
                    }
                },
                "required": ["owner", "repo", "number"]
            }),
        },
        ToolDefinition {
            name: "github_create_issue".to_string(),
            description: "Create a new issue in a GitHub repository.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "owner": {
                        "type": "string",
                        "description": "Repository owner"
                    },
                    "repo": {
                        "type": "string",
                        "description": "Repository name"
                    },
                    "title": {
                        "type": "string",
                        "description": "Issue title"
                    },
                    "body": {
                        "type": "string",
                        "description": "Issue body (markdown)"
                    }
                },
                "required": ["owner", "repo", "title"]
            }),
        },
        ToolDefinition {
            name: "github_create_pr".to_string(),
            description: "Create a pull request in a GitHub repository.".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "owner": {
                        "type": "string",
                        "description": "Repository owner"
                    },
                    "repo": {
                        "type": "string",
                        "description": "Repository name"
                    },
                    "title": {
                        "type": "string",
                        "description": "PR title"
                    },
                    "body": {
                        "type": "string",
                        "description": "PR body (markdown)"
                    },
                    "head": {
                        "type": "string",
                        "description": "Branch containing changes"
                    },
                    "base": {
                        "type": "string",
                        "description": "Branch to merge into (default: main)"
                    }
                },
                "required": ["owner", "repo", "title", "head"]
            }),
        },
    ]
}

// ═══════════════════════════════════════════════════════════════════════
//  Tool execution — delegates to shared jaskier-tools crate
// ═══════════════════════════════════════════════════════════════════════

pub async fn execute(tool_name: &str, input: &Value, state: &AppState) -> (String, bool) {
    match jaskier_tools::tools::github_tools::execute(
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
