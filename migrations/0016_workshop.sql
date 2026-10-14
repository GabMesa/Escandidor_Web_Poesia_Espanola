CREATE TABLE IF NOT EXISTS workshop_revisions (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0, mutation_token TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS contests (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 contest_key TEXT NOT NULL, data_json TEXT NOT NULL,
 PRIMARY KEY(user_id,contest_key)
);
CREATE TABLE IF NOT EXISTS poem_tags (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, color TEXT NOT NULL, PRIMARY KEY(user_id,name)
);
CREATE TABLE IF NOT EXISTS poem_tag_assignments (
 user_id INTEGER NOT NULL, poem_key TEXT NOT NULL, tag_name TEXT NOT NULL,
 PRIMARY KEY(user_id,poem_key,tag_name),
 FOREIGN KEY(user_id,tag_name) REFERENCES poem_tags(user_id,name) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS workshop_preferences (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 data_json TEXT NOT NULL DEFAULT '{}'
);
