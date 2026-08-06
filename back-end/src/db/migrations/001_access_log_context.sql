-- Additive: capture IP/user-agent context on access_logs, plus a
-- seen/unseen flag the parent-facing notification feature relies on.
-- VARCHAR(45) fits a full IPv6 address.

ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS ip_address     VARCHAR(45);
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS user_agent     TEXT;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS seen_by_parent BOOLEAN NOT NULL DEFAULT FALSE;
