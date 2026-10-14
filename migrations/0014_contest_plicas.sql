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
