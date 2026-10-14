CREATE TABLE IF NOT EXISTS user_trash_settings (
  user_id INTEGER PRIMARY KEY,
  auto_cleanup INTEGER NOT NULL DEFAULT 1 CHECK (auto_cleanup IN (0, 1)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
