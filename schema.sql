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
  font_family TEXT NOT NULL DEFAULT 'open-dyslexic',
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
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE service_features (
  service_id INTEGER NOT NULL,
  feature_id INTEGER NOT NULL,
  PRIMARY KEY (service_id, feature_id),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
);

CREATE TABLE service_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_price_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  billing_period TEXT CHECK (billing_period IN ('month', 'year')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  UNIQUE (provider, provider_price_id),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE supporters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  service_id INTEGER,
  provider TEXT NOT NULL,
  provider_supporter_id TEXT NOT NULL,
  support_type TEXT NOT NULL DEFAULT 'one_time' CHECK (support_type IN ('one_time', 'membership')),
  status TEXT NOT NULL DEFAULT 'supporter' CHECK (status IN ('supporter', 'active', 'inactive', 'cancelled')),
  display_name TEXT,
  personalized_message TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_supporter_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
);

CREATE TABLE user_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  feature_id INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('subscription', 'purchase', 'promotion', 'admin')),
  source_id TEXT,
  starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  ends_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
);

CREATE TABLE kofi_payments (
  transaction_id TEXT PRIMARY KEY,
  supporter_id INTEGER NOT NULL,
  payment_type TEXT NOT NULL,
  is_subscription_payment INTEGER NOT NULL DEFAULT 0 CHECK (is_subscription_payment IN (0, 1)),
  amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supporter_id) REFERENCES supporters(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_poems_user_updated ON poems(user_id, updated_at DESC);
CREATE INDEX idx_poem_versions_poem_version ON poem_versions(poem_id, version DESC);
CREATE INDEX idx_deleted_poems_user_deleted ON deleted_poems(user_id, deleted_at DESC, id DESC);
CREATE UNIQUE INDEX idx_deleted_poems_user_poem
  ON deleted_poems(user_id, poem_id) WHERE poem_id IS NOT NULL;
CREATE INDEX idx_service_prices_service ON service_prices(service_id, status);
CREATE INDEX idx_supporters_user_status ON supporters(user_id, status);
CREATE INDEX idx_entitlements_user_feature ON user_entitlements(user_id, feature_id, ends_at);
CREATE INDEX idx_kofi_payments_supporter ON kofi_payments(supporter_id);

CREATE VIEW current_poems AS
SELECT
  p.id,
  p.user_id,
  p.name AS title,
  p.configurations AS settings_json,
  p.font_family,
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
