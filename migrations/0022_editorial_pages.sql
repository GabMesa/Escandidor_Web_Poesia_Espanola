CREATE TABLE IF NOT EXISTS editorial_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  heading TEXT NOT NULL,
  eyebrow TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  draft_md TEXT NOT NULL DEFAULT '',
  published_md TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  show_in_nav INTEGER NOT NULL DEFAULT 0 CHECK (show_in_nav IN (0, 1)),
  nav_label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS editorial_pages_published_order
  ON editorial_pages(published, sort_order, slug);

CREATE TABLE IF NOT EXISTS editorial_pages_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
