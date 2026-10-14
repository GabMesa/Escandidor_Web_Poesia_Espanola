-- Removes only whitespace-only versions; retained versions keep their IDs and numbers.
DELETE FROM poem_versions WHERE length(trim(COALESCE(content, ''), char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))) = 0;

-- Preserve deletion markers so old local copies cannot recreate an empty poem.
INSERT INTO deleted_poems (user_id, poem_id, title, versions_json, deleted_at)
SELECT p.user_id, p.id, p.name, '[]', datetime('now') FROM poems p
WHERE NOT EXISTS (SELECT 1 FROM poem_versions pv WHERE pv.poem_id = p.id)
ON CONFLICT(user_id, poem_id) WHERE poem_id IS NOT NULL DO UPDATE SET
  versions_json = '[]', deleted_at = excluded.deleted_at;
DELETE FROM poems WHERE NOT EXISTS (SELECT 1 FROM poem_versions pv WHERE pv.poem_id = poems.id);

-- Remove blank versions from archived copies without removing tombstones.
UPDATE deleted_poems SET versions_json = (
  SELECT COALESCE(json_group_array(json(value)), '[]') FROM json_each(deleted_poems.versions_json)
  WHERE NOT (length(trim(COALESCE(json_extract(value, '$.content'), ''), char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))) = 0)
) WHERE json_valid(versions_json) AND EXISTS (
  SELECT 1 FROM json_each(deleted_poems.versions_json)
  WHERE length(trim(COALESCE(json_extract(value, '$.content'), ''), char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))) = 0
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
