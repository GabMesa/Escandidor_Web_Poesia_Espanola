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
