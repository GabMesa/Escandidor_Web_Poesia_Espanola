ALTER TABLE poem_versions ADD COLUMN client_id TEXT;
ALTER TABLE poem_versions ADD COLUMN sync_json TEXT NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX poem_version_client_id ON poem_versions(poem_id, client_id);
UPDATE poem_versions SET client_id='cloud-'||poem_id||'-'||version,
  sync_json=json_object('settings',json(COALESCE((SELECT json_set(configurations,'$.poemFont',COALESCE(json_extract(configurations,'$.poemFont'),font_family,'atkinson')) FROM poems WHERE poems.id=poem_versions.poem_id),'{}')))
  WHERE client_id IS NULL;
