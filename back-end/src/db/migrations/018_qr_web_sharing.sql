-- Existing shares retain their codes, snapshots and QR history.
ALTER TABLE shared_records ADD COLUMN IF NOT EXISTS share_token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_token_hash ON shared_records(share_token_hash)
    WHERE share_token_hash IS NOT NULL;

-- Network-address digests and counters only; no names, codes, tokens or medical text.
CREATE TABLE IF NOT EXISTS consultation_access_limits (
    bucket_key TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts INTEGER NOT NULL CHECK (attempts > 0)
);
CREATE INDEX IF NOT EXISTS idx_consultation_limits_window ON consultation_access_limits(window_start);
ALTER TABLE consultation_access_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON consultation_access_limits FROM PUBLIC;

-- SECURITY INVOKER: callers need their own table privileges, never borrowed privileges.
CREATE OR REPLACE FUNCTION public.babybook_share_snapshot_cleanup()
RETURNS INTEGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE affected INTEGER;
BEGIN
    UPDATE public.shared_records
       SET payload = '{}'::jsonb,
           status = CASE WHEN status = 'active' THEN 'expired' ELSE status END
     WHERE ((status = 'active' AND expiration_date <= now()) OR status IN ('expired', 'revoked'))
       AND (payload <> '{}'::jsonb OR status = 'active');
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.babybook_share_snapshot_cleanup() FROM PUBLIC;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON consultation_access_limits FROM anon;
        REVOKE ALL ON FUNCTION public.babybook_share_snapshot_cleanup() FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON consultation_access_limits FROM authenticated;
        REVOKE ALL ON FUNCTION public.babybook_share_snapshot_cleanup() FROM authenticated;
    END IF;
END $$;
