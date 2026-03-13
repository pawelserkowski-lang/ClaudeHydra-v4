// Jaskier Shared Pattern -- mcp/server
//! Re-exports the shared MCP server handler from `jaskier_core::mcp::server`.
//!
//! ClaudeHydra implements `HasMcpServerState` in `state.rs`, overriding
//! `mcp_tool_definitions()` and `mcp_execute_tool()` to use its `ToolExecutor`
//! pattern instead of the default Quad Hydra tool set.
//!
//! Wire as: `.route("/mcp", post(mcp::server::mcp_handler::<AppState>))`

pub use jaskier_core::mcp::server::*;
