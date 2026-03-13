-- ClaudeHydra — Session tagging & full-text search
-- Migration 027: ch_session_tags table + full-text search on ch_messages

-- 1. Session tags table
CREATE TABLE IF NOT EXISTS ch_session_tags (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES ch_sessions(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, tag)
);

-- 2. Index for tag-based filtering
CREATE INDEX IF NOT EXISTS idx_ch_session_tags_tag ON ch_session_tags(tag);
CREATE INDEX IF NOT EXISTS idx_ch_session_tags_session ON ch_session_tags(session_id);

-- 3. Full-text search vector column on messages
ALTER TABLE ch_messages ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 4. GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_ch_messages_search ON ch_messages USING GIN(search_vector);

-- 5. Function to update search_vector from content
CREATE OR REPLACE FUNCTION ch_messages_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to auto-update search_vector on INSERT/UPDATE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ch_messages_search_vector'
    ) THEN
        CREATE TRIGGER trg_ch_messages_search_vector
            BEFORE INSERT OR UPDATE OF content ON ch_messages
            FOR EACH ROW
            EXECUTE FUNCTION ch_messages_search_vector_update();
    END IF;
END $$;

-- 7. Backfill existing messages (idempotent — only updates rows with NULL vector)
UPDATE ch_messages
SET search_vector = to_tsvector('english', COALESCE(content, ''))
WHERE search_vector IS NULL;
