ALTER TABLE services ADD COLUMN key TEXT;
ALTER TABLE services ADD COLUMN name TEXT;
ALTER TABLE services ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE services ADD COLUMN created_at TEXT;
UPDATE services
SET key = 'legacy-service-' || id,
    name = description,
    created_at = datetime('now')
WHERE key IS NULL;
CREATE UNIQUE INDEX idx_services_key ON services(key);

ALTER TABLE features ADD COLUMN key TEXT;
ALTER TABLE features ADD COLUMN name TEXT;
UPDATE features SET key = 'legacy-feature-' || id, name = description WHERE key IS NULL;
CREATE UNIQUE INDEX idx_features_key ON features(key);

CREATE TABLE service_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_price_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  billing_period TEXT CHECK (billing_period IN ('month', 'year')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  UNIQUE (provider, provider_price_id),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_subscription_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_subscription_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
);

CREATE TABLE user_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  feature_id INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('subscription', 'purchase', 'promotion', 'admin')),
  source_id TEXT,
  starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  ends_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
);

CREATE INDEX idx_service_prices_service ON service_prices(service_id, status);
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX idx_entitlements_user_feature ON user_entitlements(user_id, feature_id, ends_at);