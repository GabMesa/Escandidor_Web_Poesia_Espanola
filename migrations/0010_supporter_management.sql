ALTER TABLE supporters ADD COLUMN personalized_message TEXT;
ALTER TABLE kofi_payments ADD COLUMN amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0);
ALTER TABLE kofi_payments ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE kofi_payments ADD COLUMN paid_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';

UPDATE kofi_payments SET paid_at = created_at WHERE paid_at = '1970-01-01 00:00:00';