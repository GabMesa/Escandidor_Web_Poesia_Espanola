PRAGMA foreign_keys = OFF;

CREATE TABLE supporters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  service_id INTEGER,
  provider TEXT NOT NULL,
  provider_supporter_id TEXT NOT NULL,
  support_type TEXT NOT NULL DEFAULT 'one_time' CHECK (support_type IN ('one_time', 'membership')),
  status TEXT NOT NULL DEFAULT 'supporter' CHECK (status IN ('supporter', 'active', 'inactive', 'cancelled')),
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_supporter_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
);

INSERT INTO supporters (
  user_id, service_id, provider, provider_supporter_id, support_type,
  status, current_period_end, created_at, updated_at
)
SELECT
  user_id, service_id, provider, provider_subscription_id, 'membership',
  CASE WHEN status IN ('active', 'inactive', 'cancelled') THEN status ELSE 'inactive' END,
  current_period_end, created_at, updated_at
FROM subscriptions;

DROP INDEX idx_subscriptions_user_status;
DROP TABLE subscriptions;

CREATE TABLE kofi_payments (
  transaction_id TEXT PRIMARY KEY,
  supporter_id INTEGER NOT NULL,
  payment_type TEXT NOT NULL,
  is_subscription_payment INTEGER NOT NULL DEFAULT 0 CHECK (is_subscription_payment IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supporter_id) REFERENCES supporters(id) ON DELETE CASCADE
);

CREATE INDEX idx_supporters_user_status ON supporters(user_id, status);
CREATE INDEX idx_kofi_payments_supporter ON kofi_payments(supporter_id);

PRAGMA foreign_keys = ON;