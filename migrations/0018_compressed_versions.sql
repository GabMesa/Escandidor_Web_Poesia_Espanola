CREATE TABLE IF NOT EXISTS compressed_poem_versions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  poem_id INTEGER NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  client_id TEXT,
  replacement_version INTEGER NOT NULL,
  version_json TEXT NOT NULL,
  compressed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(poem_id,version)
);
CREATE INDEX IF NOT EXISTS compressed_versions_user ON compressed_poem_versions(user_id,poem_id);
CREATE INDEX IF NOT EXISTS compressed_versions_client ON compressed_poem_versions(user_id,client_id);
