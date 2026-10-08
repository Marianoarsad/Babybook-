-- Retry receipts contain identifiers/digests only, never record contents.
CREATE TABLE IF NOT EXISTS mutation_receipts (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    resource TEXT NOT NULL,
    operation_key VARCHAR(64) NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    record_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, child_id, resource, operation_key)
);
CREATE INDEX IF NOT EXISTS idx_mutation_receipts_child ON mutation_receipts(child_id);
CREATE INDEX IF NOT EXISTS idx_mutation_receipts_record ON mutation_receipts(user_id, child_id, resource, record_id);
ALTER TABLE mutation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mutation_receipts FROM PUBLIC;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON mutation_receipts FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON mutation_receipts FROM authenticated;
    END IF;
END $$;
