ALTER TABLE poems ADD COLUMN font_family TEXT NOT NULL DEFAULT 'open-dyslexic';

UPDATE poems
SET font_family = COALESCE(
  json_extract(configurations, '$.poemFont'),
  'open-dyslexic'
);

DROP VIEW current_poems;

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
