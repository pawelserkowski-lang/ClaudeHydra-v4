-- Message compaction thresholds (configurable via Settings)
ALTER TABLE ch_settings ADD COLUMN IF NOT EXISTS compaction_threshold INTEGER NOT NULL DEFAULT 25;
ALTER TABLE ch_settings ADD COLUMN IF NOT EXISTS compaction_keep INTEGER NOT NULL DEFAULT 15;
