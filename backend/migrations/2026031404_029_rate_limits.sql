-- Configurable per-endpoint rate limits
-- Replaces hardcoded GovernorLayer values with DB-driven configuration

CREATE TABLE IF NOT EXISTS ch_rate_limits (
    id              SERIAL PRIMARY KEY,
    endpoint_group  TEXT UNIQUE NOT NULL,
    requests_per_minute INTEGER NOT NULL,
    burst_size      INTEGER NOT NULL,
    enabled         BOOLEAN DEFAULT true,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default values matching current hardcoded rates
INSERT INTO ch_rate_limits (endpoint_group, requests_per_minute, burst_size, enabled)
VALUES
    ('chat_stream', 20, 20, true),
    ('chat',        30, 30, true),
    ('a2a',         10,  3, true),
    ('default',    120, 120, true)
ON CONFLICT (endpoint_group) DO NOTHING;
