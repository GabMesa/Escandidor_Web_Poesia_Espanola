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
