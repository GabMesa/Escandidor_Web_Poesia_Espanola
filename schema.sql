PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  discord_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE poems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  configurations TEXT NOT NULL DEFAULT '{}',
  color_index INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE poem_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poem_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (poem_id, version),
  FOREIGN KEY (poem_id) REFERENCES poems(id) ON DELETE CASCADE
);

CREATE TABLE deleted_poems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  poem_id INTEGER,
  title TEXT NOT NULL,
  versions_json TEXT NOT NULL DEFAULT '[]',
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL
);

CREATE TABLE features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL
);

CREATE TABLE service_features (
  service_id INTEGER NOT NULL,
  feature_id INTEGER NOT NULL,
  PRIMARY KEY (service_id, feature_id),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
);

CREATE TABLE payments (
  payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_poems_user_updated ON poems(user_id, updated_at DESC);
CREATE INDEX idx_poem_versions_poem_version ON poem_versions(poem_id, version DESC);
CREATE INDEX idx_deleted_poems_user_deleted ON deleted_poems(user_id, deleted_at DESC, id DESC);
CREATE UNIQUE INDEX idx_deleted_poems_user_poem
  ON deleted_poems(user_id, poem_id) WHERE poem_id IS NOT NULL;
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_service_id ON payments(service_id);

CREATE VIEW current_poems AS
SELECT
  p.id,
  p.user_id,
  p.name AS title,
  p.configurations AS settings_json,
  p.color_index,
  p.created_at,
  p.updated_at,
  pv.name AS version_name,
  pv.content,
  pv.version
FROM poems p
JOIN poem_versions pv ON pv.poem_id = p.id
WHERE pv.version = (
  SELECT MAX(latest.version)
  FROM poem_versions latest
  WHERE latest.poem_id = p.id
);
