ALTER TABLE deleted_poems ADD COLUMN poem_id INTEGER;

INSERT INTO deleted_poems (user_id, poem_id, title, versions_json, deleted_at)
SELECT user_id, poem_id, title, '[]', deleted_at
FROM poem_tombstones;

DROP TABLE poem_tombstones;

CREATE UNIQUE INDEX idx_deleted_poems_user_poem
  ON deleted_poems(user_id, poem_id) WHERE poem_id IS NOT NULL;