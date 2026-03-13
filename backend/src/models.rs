use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ── DB row types ────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
pub struct SettingsRow {
    pub theme: String,
    pub language: String,
    pub default_model: String,
    pub auto_start: bool,
    pub welcome_message: String,
    /// Working directory for filesystem tools (empty = uses ALLOWED_FILE_DIRS / Desktop fallback)
    #[sqlx(default)]
    pub working_directory: String,
    /// Max tool-call iterations per agent request (default 10)
    #[sqlx(default)]
    pub max_iterations: i32,
    /// Temperature for generation (default 0.7)
    #[sqlx(default)]
    pub temperature: f64,
    /// Max output tokens (default 4096)
    #[sqlx(default)]
    pub max_tokens: i32,
    /// Custom instructions injected into system prompt
    #[sqlx(default)]
    pub custom_instructions: String,
    /// Auto-updater enabled
    #[sqlx(default)]
    pub auto_updater: bool,
    /// Telemetry (error reporting) enabled
    #[sqlx(default)]
    pub telemetry: bool,
    /// Message compaction threshold — compact after this many messages (default 25)
    #[sqlx(default)]
    pub compaction_threshold: i32,
    /// Message compaction keep — keep this many recent messages after compaction (default 15)
    #[sqlx(default)]
    pub compaction_keep: i32,
}

#[derive(sqlx::FromRow)]
pub struct SessionRow {
    pub id: uuid::Uuid,
    pub title: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    #[sqlx(default)]
    pub working_directory: String,
}

#[derive(sqlx::FromRow)]
pub struct SessionSummaryRow {
    pub id: uuid::Uuid,
    pub title: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub message_count: i64,
    #[sqlx(default)]
    pub working_directory: String,
}

#[derive(sqlx::FromRow)]
pub struct MessageRow {
    pub id: uuid::Uuid,
    pub session_id: uuid::Uuid,
    pub role: String,
    pub content: String,
    pub model: Option<String>,
    pub agent: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// ── Agent ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WitcherAgent {
    pub id: String,
    pub name: String,
    pub role: String,
    pub tier: String,
    pub status: String,
    pub description: String,
    pub model: String,
}

// ── Health ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub app: String,
    pub uptime_seconds: u64,
    pub providers: Vec<ProviderInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub browser_proxy: Option<crate::browser_proxy::BrowserProxyStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProviderInfo {
    pub name: String,
    pub available: bool,
}

// ── Chat ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    pub model: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub stream: Option<bool>,
    pub tools_enabled: Option<bool>,
    #[serde(default)]
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ChatResponse {
    pub id: String,
    pub message: ChatMessage,
    pub model: String,
    pub usage: Option<UsageInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UsageInfo {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

// ── Claude Models ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ClaudeModelInfo {
    pub id: String,
    pub name: String,
    pub tier: String,
    pub provider: String,
    pub available: bool,
}

// ── Settings ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub default_model: String,
    pub auto_start: bool,
    pub welcome_message: String,
    /// Working directory for filesystem tools (empty = uses ALLOWED_FILE_DIRS / Desktop fallback)
    #[serde(default)]
    pub working_directory: String,
    /// Max tool-call iterations per agent request (default 10)
    #[serde(default = "default_max_iterations")]
    pub max_iterations: i32,
    /// Temperature for generation (default 0.7)
    #[serde(default = "default_temperature")]
    pub temperature: f64,
    /// Max output tokens (default 4096)
    #[serde(default = "default_max_tokens")]
    pub max_tokens: i32,
    /// Custom instructions injected into system prompt
    #[serde(default)]
    pub custom_instructions: String,
    /// Auto-updater enabled (check for new versions)
    #[serde(default = "default_true")]
    pub auto_updater: bool,
    /// Telemetry (error reporting) enabled
    #[serde(default)]
    pub telemetry: bool,
    /// Message compaction threshold — compact after this many messages (default 25)
    #[serde(default = "default_compaction_threshold")]
    pub compaction_threshold: i32,
    /// Message compaction keep — keep this many recent messages after compaction (default 15)
    #[serde(default = "default_compaction_keep")]
    pub compaction_keep: i32,
}

fn default_true() -> bool {
    true
}

fn default_max_iterations() -> i32 {
    10
}

fn default_temperature() -> f64 {
    0.7
}

fn default_max_tokens() -> i32 {
    4096
}

fn default_compaction_threshold() -> i32 {
    25
}

fn default_compaction_keep() -> i32 {
    15
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ApiKeyRequest {
    pub provider: String,
    pub key: String,
}

// ── History ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HistoryEntry {
    pub id: String,
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent: Option<String>,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_interactions: Option<Vec<ToolInteractionInfo>>,
}

// ── Session ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Session {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub messages: Vec<HistoryEntry>,
}

/// Lightweight view returned in session listing (no messages body).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SessionSummary {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub message_count: usize,
    #[serde(default)]
    pub working_directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateSessionRequest {
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateSessionRequest {
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateWorkingDirectoryRequest {
    pub working_directory: String,
}

// ── Prompt History ─────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
pub struct PromptHistoryRow {
    pub id: i32,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AddPromptRequest {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AddMessageRequest {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_interactions: Option<Vec<ToolInteractionInfo>>,
}

// ── System ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SystemStats {
    pub cpu_usage_percent: f32,
    pub memory_used_mb: f64,
    pub memory_total_mb: f64,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MetricItem {
    pub label: String,
    pub value: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NetworkMetric {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ping: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SystemMetricsResponse {
    pub cpu: MetricItem,
    pub ram: MetricItem,
    pub network: NetworkMetric,
}

// ── Tool Use (Anthropic API) ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

/// DB row for tool interactions.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ToolInteractionRow {
    pub id: uuid::Uuid,
    pub message_id: uuid::Uuid,
    pub tool_use_id: String,
    pub tool_name: String,
    pub tool_input: Value,
    pub result: Option<String>,
    pub is_error: bool,
    pub executed_at: chrono::DateTime<chrono::Utc>,
}

/// Serializable tool interaction for API responses.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ToolInteractionInfo {
    pub tool_use_id: String,
    pub tool_name: String,
    #[schema(value_type = Object)]
    pub tool_input: Value,
    pub result: Option<String>,
    pub is_error: bool,
}

// ═══════════════════════════════════════════════════════════════════════
//  WebSocket Protocol — Jaskier Shared Pattern
// ═══════════════════════════════════════════════════════════════════════

/// Messages sent from the frontend client to the backend via WebSocket.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsClientMessage {
    /// Start a new chat execution.
    Execute {
        prompt: String,
        #[serde(default)]
        model: Option<String>,
        #[serde(default)]
        tools_enabled: Option<bool>,
        #[serde(default)]
        session_id: Option<String>,
    },
    /// Cancel the currently running execution.
    Cancel,
    /// Heartbeat ping — expects a `Pong` response.
    Ping,
}

/// Messages sent from the backend to the frontend client via WebSocket.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsServerMessage {
    /// Execution has started.
    Start {
        id: String,
        model: String,
        #[serde(skip_serializing_if = "Vec::is_empty", default)]
        files_loaded: Vec<String>,
    },
    /// A streamed text token.
    Token { content: String },
    /// Execution completed successfully.
    Complete { duration_ms: u64 },
    /// A tool call has been initiated.
    ToolCall {
        name: String,
        args: Value,
        iteration: u32,
    },
    /// A tool call has completed.
    ToolResult {
        name: String,
        success: bool,
        summary: String,
        iteration: u32,
    },
    /// Progress update for parallel tool execution.
    ToolProgress {
        iteration: u32,
        tools_completed: u32,
        tools_total: u32,
    },
    /// Current iteration in the tool-use loop.
    Iteration { number: u32, max: u32 },
    /// An error occurred during execution.
    Error {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
    },
    /// Heartbeat pong response.
    Pong,
    /// Server-initiated heartbeat to keep the connection alive.
    Heartbeat,
    /// Model fallback occurred (rate-limited or error on primary model).
    Fallback {
        from: String,
        to: String,
        reason: String,
    },
}

// ── Agent Config (DB-driven) ────────────────────────────────────────────

/// DB row for agent configuration (ch_agents_config table).
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AgentConfigRow {
    pub id: String,
    pub name: String,
    pub role: String,
    pub tier: String,
    pub status: String,
    pub description: String,
    pub model: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<AgentConfigRow> for WitcherAgent {
    fn from(row: AgentConfigRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            role: row.role,
            tier: row.tier,
            status: row.status,
            description: row.description,
            model: row.model,
        }
    }
}

/// Request body for creating a new agent.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateAgentRequest {
    pub name: String,
    pub role: String,
    pub tier: String,
    #[serde(default = "default_agent_status")]
    pub status: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub model: String,
}

fn default_agent_status() -> String {
    "active".to_string()
}

/// Request body for updating an existing agent (partial update).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateAgentRequest {
    pub name: Option<String>,
    pub role: Option<String>,
    pub tier: Option<String>,
    pub status: Option<String>,
    pub description: Option<String>,
    pub model: Option<String>,
}
