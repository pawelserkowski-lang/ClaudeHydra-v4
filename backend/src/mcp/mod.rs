// Jaskier Shared Pattern -- mcp
//! MCP (Model Context Protocol) support — client, config, and server.
//!
//! ## Architecture (ClaudeHydra)
//!
//! - **client**: Re-exports `jaskier_core::mcp::client::*` — shared `McpClientManager` with
//!   `call_tool(prefixed_name, args)` API used by `tools/mod.rs` and `handlers/streaming.rs`.
//! - **config**: Shared types + DB functions from `jaskier_core::mcp::config`, with local
//!   HTTP handlers that match ClaudeHydra's API contract (bare `Json<Value>` returns).
//! - **server**: Re-exports shared `mcp_handler` from `jaskier_core::mcp::server`.
//!   ClaudeHydra overrides `mcp_tool_definitions()` and `mcp_execute_tool()` via
//!   `HasMcpServerState` impl in `state.rs` to use its `ToolExecutor` pattern.

pub mod client;
pub mod config;
pub mod server;
