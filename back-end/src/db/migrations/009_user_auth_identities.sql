CREATE TABLE IF NOT EXISTS user_auth_identities (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'facebook')),
    provider_subject TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_subject),
    UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_auth_identities_user
    ON user_auth_identities(user_id);

-- Identity links are server-only, not a public Supabase collection.
ALTER TABLE user_auth_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_auth_identities FROM PUBLIC;
REVOKE ALL ON SEQUENCE user_auth_identities_id_seq FROM PUBLIC;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON user_auth_identities FROM anon;
        REVOKE ALL ON SEQUENCE user_auth_identities_id_seq FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON user_auth_identities FROM authenticated;
        REVOKE ALL ON SEQUENCE user_auth_identities_id_seq FROM authenticated;
    END IF;
END $$;
