ALTER TABLE poems ADD COLUMN title_key TEXT;
CREATE UNIQUE INDEX poems_user_title_key ON poems(user_id,title_key);
-- Original rows remain available as a full backup after their histories merge.
CREATE TABLE IF NOT EXISTS merged_poems (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 source_id INTEGER NOT NULL PRIMARY KEY,
 target_id INTEGER NOT NULL,
 merged_at TEXT NOT NULL DEFAULT (datetime('now'))
);
