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
