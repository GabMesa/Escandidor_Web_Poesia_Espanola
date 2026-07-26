-- Only for databases that applied the earlier title-keyed version of migration 0004.
-- Verify poem_tombstones is empty before running this corrective migration.
DROP TABLE poem_tombstones;

CREATE TABLE poem_tombstones (
  user_id INTEGER NOT NULL,
  poem_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, poem_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);