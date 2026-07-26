CREATE TABLE poem_tombstones (
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, title),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);