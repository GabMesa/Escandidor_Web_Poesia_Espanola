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
  title_key TEXT,
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
  client_id TEXT,
  sync_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE (poem_id, version),
  UNIQUE (poem_id, client_id),
  FOREIGN KEY (poem_id) REFERENCES poems(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX poems_user_title_key ON poems(user_id,title_key);
CREATE TABLE IF NOT EXISTS merged_poems (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 source_id INTEGER NOT NULL PRIMARY KEY,
 target_id INTEGER NOT NULL,
 merged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

-- Enforce the empty-content rule for older clients and every write path.
CREATE TRIGGER IF NOT EXISTS poem_versions_require_content_insert
BEFORE INSERT ON poem_versions WHEN length(trim(COALESCE(NEW.content, ''), char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))) = 0
BEGIN SELECT RAISE(ABORT, 'El poema debe tener al menos un verso.'); END;
CREATE TRIGGER IF NOT EXISTS poem_versions_require_content_update
BEFORE UPDATE OF content ON poem_versions WHEN length(trim(COALESCE(NEW.content, ''), char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))) = 0
BEGIN SELECT RAISE(ABORT, 'El poema debe tener al menos un verso.'); END;
CREATE TRIGGER IF NOT EXISTS poems_require_title_insert
BEFORE INSERT ON poems WHEN length(trim(COALESCE(NEW.name, ''), char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))) = 0 OR replace(replace(replace(replace(replace(replace(lower(replace(replace(NEW.name, 'í', 'i'), 'Í', 'i')), char(9), ''), char(10), ''), char(13), ''), char(32), ''), char(160), ''), char(769), '') = 'sintitulo'
BEGIN SELECT RAISE(ABORT, 'El poema debe tener un titulo valido.'); END;
CREATE TRIGGER IF NOT EXISTS poems_require_title_update
BEFORE UPDATE OF name ON poems WHEN length(trim(COALESCE(NEW.name, ''), char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))) = 0 OR replace(replace(replace(replace(replace(replace(lower(replace(replace(NEW.name, 'í', 'i'), 'Í', 'i')), char(9), ''), char(10), ''), char(13), ''), char(32), ''), char(160), ''), char(769), '') = 'sintitulo'
BEGIN SELECT RAISE(ABORT, 'El poema debe tener un titulo valido.'); END;

CREATE TRIGGER IF NOT EXISTS poem_versions_skip_consecutive_duplicates
BEFORE INSERT ON poem_versions WHEN EXISTS (
  SELECT 1 FROM poem_versions previous WHERE previous.poem_id = NEW.poem_id
    AND previous.version = (SELECT MAX(version) FROM poem_versions WHERE poem_id = NEW.poem_id)
    AND rtrim(replace(replace(previous.content, char(13) || char(10), char(10)), char(13), char(10)), char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)) = rtrim(replace(replace(NEW.content, char(13) || char(10), char(10)), char(13), char(10)), char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))
)
BEGIN SELECT RAISE(IGNORE); END;

CREATE TABLE IF NOT EXISTS user_trash_settings (
  user_id INTEGER PRIMARY KEY,
  auto_cleanup INTEGER NOT NULL DEFAULT 1 CHECK (auto_cleanup IN (0, 1)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_contest_plicas (
  user_id INTEGER NOT NULL,
  contest_key TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  identity_document TEXT NOT NULL DEFAULT '',
  postal_address TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  biography TEXT NOT NULL DEFAULT '',
  include_ai INTEGER NOT NULL DEFAULT 0 CHECK (include_ai IN (0,1)),
  ai_statement TEXT NOT NULL DEFAULT '',
  signature_name TEXT NOT NULL DEFAULT '',
  signature_date TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, contest_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE user_plica_profiles (
  user_id INTEGER PRIMARY KEY,
  encrypted_sensitive TEXT NOT NULL,
  include_ai INTEGER NOT NULL DEFAULT 0 CHECK(include_ai IN (0,1)),
  ai_statement TEXT NOT NULL DEFAULT '',
  signature_date TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- The retired table is read only while the server migrates legacy profiles.
CREATE TRIGGER plicas_retired_insert BEFORE INSERT ON user_contest_plicas
BEGIN SELECT RAISE(ABORT,'La plica se guarda en el perfil del usuario.'); END;
CREATE TRIGGER plicas_retired_update BEFORE UPDATE ON user_contest_plicas
BEGIN SELECT RAISE(ABORT,'La plica se guarda en el perfil del usuario.'); END;

CREATE TABLE IF NOT EXISTS workshop_revisions (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0, mutation_token TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS contests (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 contest_key TEXT NOT NULL, data_json TEXT NOT NULL,
 PRIMARY KEY(user_id,contest_key)
);
CREATE TABLE IF NOT EXISTS poem_tags (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, color TEXT NOT NULL, PRIMARY KEY(user_id,name)
);
CREATE TABLE IF NOT EXISTS poem_tag_assignments (
 user_id INTEGER NOT NULL, poem_key TEXT NOT NULL, tag_name TEXT NOT NULL,
 PRIMARY KEY(user_id,poem_key,tag_name),
 FOREIGN KEY(user_id,tag_name) REFERENCES poem_tags(user_id,name) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS workshop_preferences (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 data_json TEXT NOT NULL DEFAULT '{}'
);
-- One indexed revision per account avoids repeatedly scanning every stored version.
CREATE TABLE IF NOT EXISTS library_revisions (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0
);

CREATE TRIGGER IF NOT EXISTS library_revision_poems_insert
AFTER INSERT ON poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_poems_update
AFTER UPDATE ON poems
WHEN OLD.user_id IS NOT NEW.user_id OR OLD.name IS NOT NEW.name OR OLD.configurations IS NOT NEW.configurations OR OLD.font_family IS NOT NEW.font_family OR OLD.color_index IS NOT NEW.color_index OR OLD.updated_at IS NOT NEW.updated_at
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id UNION SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_poems_delete
AFTER DELETE ON poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_poem_versions_insert
AFTER INSERT ON poem_versions
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT user_id AS owner_id FROM poems WHERE id=NEW.poem_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_poem_versions_update
AFTER UPDATE ON poem_versions
WHEN OLD.poem_id IS NOT NEW.poem_id OR OLD.name IS NOT NEW.name OR OLD.content IS NOT NEW.content OR OLD.version IS NOT NEW.version OR OLD.created_at IS NOT NEW.created_at OR OLD.client_id IS NOT NEW.client_id OR OLD.sync_json IS NOT NEW.sync_json
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT user_id AS owner_id FROM poems WHERE id=OLD.poem_id UNION SELECT user_id AS owner_id FROM poems WHERE id=NEW.poem_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_poem_versions_delete
AFTER DELETE ON poem_versions
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT user_id AS owner_id FROM poems WHERE id=OLD.poem_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_deleted_poems_insert
AFTER INSERT ON deleted_poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_deleted_poems_update
AFTER UPDATE ON deleted_poems
WHEN OLD.user_id IS NOT NEW.user_id OR OLD.poem_id IS NOT NEW.poem_id OR OLD.title IS NOT NEW.title OR OLD.versions_json IS NOT NEW.versions_json OR OLD.deleted_at IS NOT NEW.deleted_at
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id UNION SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_deleted_poems_delete
AFTER DELETE ON deleted_poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_compressed_poem_versions_insert
AFTER INSERT ON compressed_poem_versions
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_compressed_poem_versions_update
AFTER UPDATE ON compressed_poem_versions
WHEN OLD.user_id IS NOT NEW.user_id OR OLD.poem_id IS NOT NEW.poem_id OR OLD.version IS NOT NEW.version OR OLD.client_id IS NOT NEW.client_id OR OLD.replacement_version IS NOT NEW.replacement_version OR OLD.version_json IS NOT NEW.version_json
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id UNION SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_compressed_poem_versions_delete
AFTER DELETE ON compressed_poem_versions
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_merged_poems_insert
AFTER INSERT ON merged_poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_merged_poems_update
AFTER UPDATE ON merged_poems
WHEN OLD.user_id IS NOT NEW.user_id OR OLD.source_id IS NOT NEW.source_id OR OLD.target_id IS NOT NEW.target_id
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id UNION SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_merged_poems_delete
AFTER DELETE ON merged_poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_user_trash_settings_insert
AFTER INSERT ON user_trash_settings
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_user_trash_settings_update
AFTER UPDATE ON user_trash_settings
WHEN OLD.user_id IS NOT NEW.user_id OR OLD.auto_cleanup IS NOT NEW.auto_cleanup
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id UNION SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_user_trash_settings_delete
AFTER DELETE ON user_trash_settings
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_contests_insert
AFTER INSERT ON contests
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_contests_update
AFTER UPDATE ON contests
WHEN OLD.user_id IS NOT NEW.user_id OR OLD.contest_key IS NOT NEW.contest_key OR OLD.data_json IS NOT NEW.data_json
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id UNION SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;

CREATE TRIGGER IF NOT EXISTS library_revision_contests_delete
AFTER DELETE ON contests
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
END;
-- Keep a compact change journal; version contents stay in poem_versions.
CREATE TABLE IF NOT EXISTS library_changes (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL,
 poem_id INTEGER NOT NULL,
 version INTEGER,
 PRIMARY KEY(user_id,revision)
);

DROP TRIGGER IF EXISTS library_revision_poems_insert;
CREATE TRIGGER IF NOT EXISTS library_revision_poems_insert
AFTER INSERT ON poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,NEW.id,NULL FROM library_revisions
 WHERE user_id=NEW.user_id AND user_id IN(SELECT id FROM users);
END;

DROP TRIGGER IF EXISTS library_revision_poems_update;
CREATE TRIGGER IF NOT EXISTS library_revision_poems_update
AFTER UPDATE ON poems
WHEN OLD.user_id IS NOT NEW.user_id OR OLD.name IS NOT NEW.name OR OLD.configurations IS NOT NEW.configurations OR OLD.font_family IS NOT NEW.font_family OR OLD.color_index IS NOT NEW.color_index OR OLD.updated_at IS NOT NEW.updated_at
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id UNION SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,NEW.id,NULL FROM library_revisions
 WHERE user_id=NEW.user_id AND user_id IN(SELECT id FROM users);
END;

DROP TRIGGER IF EXISTS library_revision_poems_delete;
CREATE TRIGGER IF NOT EXISTS library_revision_poems_delete
AFTER DELETE ON poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,OLD.id,NULL FROM library_revisions
 WHERE user_id=OLD.user_id AND user_id IN(SELECT id FROM users);
END;

DROP TRIGGER IF EXISTS library_revision_poem_versions_insert;
CREATE TRIGGER IF NOT EXISTS library_revision_poem_versions_insert
AFTER INSERT ON poem_versions
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT user_id AS owner_id FROM poems WHERE id=NEW.poem_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,NEW.poem_id,NEW.version FROM library_revisions
 WHERE user_id=(SELECT user_id FROM poems WHERE id=NEW.poem_id) AND user_id IN(SELECT id FROM users);
END;

DROP TRIGGER IF EXISTS library_revision_poem_versions_update;
CREATE TRIGGER IF NOT EXISTS library_revision_poem_versions_update
AFTER UPDATE ON poem_versions
WHEN OLD.poem_id IS NOT NEW.poem_id OR OLD.name IS NOT NEW.name OR OLD.content IS NOT NEW.content OR OLD.version IS NOT NEW.version OR OLD.created_at IS NOT NEW.created_at OR OLD.client_id IS NOT NEW.client_id OR OLD.sync_json IS NOT NEW.sync_json
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT user_id AS owner_id FROM poems WHERE id=OLD.poem_id UNION SELECT user_id AS owner_id FROM poems WHERE id=NEW.poem_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,NEW.poem_id,NEW.version FROM library_revisions
 WHERE user_id=(SELECT user_id FROM poems WHERE id=NEW.poem_id) AND user_id IN(SELECT id FROM users);
END;

DROP TRIGGER IF EXISTS library_revision_poem_versions_delete;
CREATE TRIGGER IF NOT EXISTS library_revision_poem_versions_delete
AFTER DELETE ON poem_versions
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT user_id AS owner_id FROM poems WHERE id=OLD.poem_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,OLD.poem_id,OLD.version FROM library_revisions
 WHERE user_id=(SELECT user_id FROM poems WHERE id=OLD.poem_id) AND user_id IN(SELECT id FROM users);
END;

DROP TRIGGER IF EXISTS library_revision_deleted_poems_insert;
CREATE TRIGGER IF NOT EXISTS library_revision_deleted_poems_insert
AFTER INSERT ON deleted_poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,NEW.poem_id,NULL FROM library_revisions
 WHERE user_id=NEW.user_id AND NEW.poem_id IS NOT NULL AND user_id IN(SELECT id FROM users);
END;

DROP TRIGGER IF EXISTS library_revision_deleted_poems_update;
CREATE TRIGGER IF NOT EXISTS library_revision_deleted_poems_update
AFTER UPDATE ON deleted_poems
WHEN OLD.user_id IS NOT NEW.user_id OR OLD.poem_id IS NOT NEW.poem_id OR OLD.title IS NOT NEW.title OR OLD.versions_json IS NOT NEW.versions_json OR OLD.deleted_at IS NOT NEW.deleted_at
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id UNION SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,NEW.poem_id,NULL FROM library_revisions
 WHERE user_id=NEW.user_id AND NEW.poem_id IS NOT NULL AND user_id IN(SELECT id FROM users);
END;

DROP TRIGGER IF EXISTS library_revision_deleted_poems_delete;
CREATE TRIGGER IF NOT EXISTS library_revision_deleted_poems_delete
AFTER DELETE ON deleted_poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,OLD.poem_id,NULL FROM library_revisions
 WHERE user_id=OLD.user_id AND OLD.poem_id IS NOT NULL AND user_id IN(SELECT id FROM users);
END;

DROP TRIGGER IF EXISTS library_revision_merged_poems_insert;
CREATE TRIGGER IF NOT EXISTS library_revision_merged_poems_insert
AFTER INSERT ON merged_poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,NEW.source_id,NULL FROM library_revisions
 WHERE user_id=NEW.user_id AND NEW.source_id IS NOT NULL AND user_id IN(SELECT id FROM users);
END;

DROP TRIGGER IF EXISTS library_revision_merged_poems_update;
CREATE TRIGGER IF NOT EXISTS library_revision_merged_poems_update
AFTER UPDATE ON merged_poems
WHEN OLD.user_id IS NOT NEW.user_id OR OLD.source_id IS NOT NEW.source_id OR OLD.target_id IS NOT NEW.target_id
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id UNION SELECT NEW.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,NEW.source_id,NULL FROM library_revisions
 WHERE user_id=NEW.user_id AND NEW.source_id IS NOT NULL AND user_id IN(SELECT id FROM users);
END;

DROP TRIGGER IF EXISTS library_revision_merged_poems_delete;
CREATE TRIGGER IF NOT EXISTS library_revision_merged_poems_delete
AFTER DELETE ON merged_poems
BEGIN
 INSERT INTO library_revisions(user_id,revision)
 SELECT owner_id,1 FROM (SELECT OLD.user_id AS owner_id) WHERE owner_id IN(SELECT id FROM users)
 ON CONFLICT(user_id) DO UPDATE SET revision=revision+1;
 INSERT INTO library_changes(user_id,revision,poem_id,version)
 SELECT user_id,revision,OLD.source_id,NULL FROM library_revisions
 WHERE user_id=OLD.user_id AND OLD.source_id IS NOT NULL AND user_id IN(SELECT id FROM users);
END;
