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
