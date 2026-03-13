-- Performance indexes for ch_messages table
-- Complements existing idx_ch_msg_session (session_id, created_at ASC)

-- Composite index for fast session history retrieval (newest first)
CREATE INDEX IF NOT EXISTS idx_ch_messages_session_created_desc
    ON ch_messages(session_id, created_at DESC);

-- Standalone index on session_id for counting messages per session
CREATE INDEX IF NOT EXISTS idx_ch_messages_session_id
    ON ch_messages(session_id);

-- Index on created_at for time-range queries and cleanup operations
CREATE INDEX IF NOT EXISTS idx_ch_messages_created_at
    ON ch_messages(created_at);

-- Index on role for filtering system/user/assistant messages
CREATE INDEX IF NOT EXISTS idx_ch_messages_role
    ON ch_messages(role);
