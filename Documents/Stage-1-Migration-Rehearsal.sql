-- LOCAL ONLY. Loaded by Stage-1-Migration-Rehearsal.cjs after a schema-only import.
DO $$ BEGIN
 IF current_database()<>'babybook_stage0_test' OR inet_server_port()<>55432
    OR inet_server_addr()<>inet '127.0.0.1' THEN
  RAISE EXCEPTION 'Only the disposable loopback Stage 0 test database is permitted';
 END IF;
END $$;
CREATE TEMP TABLE stage1_preservation_audit(table_name TEXT PRIMARY KEY, fingerprint TEXT) ON COMMIT DROP;
DO $$ DECLARE table_name TEXT; BEGIN
 FOREACH table_name IN ARRAY ARRAY['users','children','vaccinations','checkups','medical_history','medication_doses','growth_records','milestones','nutrition_records','memories','reminders','calendar_events','record_attachments','access_logs','shared_records','password_resets','feed_logs','sleep_logs','temperature_logs','schema_migrations']
 LOOP
  EXECUTE format('INSERT INTO stage1_preservation_audit SELECT %L, md5(COALESCE(jsonb_agg(jsonb_strip_nulls(to_jsonb(t)) ORDER BY to_jsonb(t)::text)::text,''[]'')) FROM public.%I t',table_name,table_name);
 END LOOP;
END $$;
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

CREATE TABLE IF NOT EXISTS calendar_plan_statuses (
    id              SERIAL PRIMARY KEY,
    child_id        INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    source_type     VARCHAR(30) NOT NULL
                    CHECK (source_type IN ('vaccination', 'checkup', 'medical-history', 'calendar-event')),
    source_id       INTEGER NOT NULL CHECK (source_id > 0),
    occurrence_date DATE NOT NULL,
    completed       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (child_id, source_type, source_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_plan_statuses_child_date
    ON calendar_plan_statuses(child_id, occurrence_date DESC, id DESC);

DROP TRIGGER IF EXISTS trg_calendar_plan_statuses_updated ON calendar_plan_statuses;
CREATE TRIGGER trg_calendar_plan_statuses_updated BEFORE UPDATE ON calendar_plan_statuses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE calendar_plan_statuses ENABLE ROW LEVEL SECURITY;

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

-- Optional because older formula records have no reliable scoop count to
-- backfill. NUMERIC supports common half-scoop measurements without floating
-- point drift.
ALTER TABLE nutrition_records ADD COLUMN IF NOT EXISTS formula_scoops NUMERIC(5,2)
    CHECK (
        formula_scoops IS NULL OR (
            formula_scoops > 0
            AND entry_type = 'milk'
            AND milk_type IN ('Formula', 'Mixed')
        )
    );

-- Mixed bottles record formula and breastmilk separately. Nullable keeps
-- historical rows valid because their original split cannot be reconstructed.
ALTER TABLE nutrition_records ADD COLUMN IF NOT EXISTS breastmilk_quantity NUMERIC(7,2)
    CHECK (
        breastmilk_quantity IS NULL OR (
            breastmilk_quantity > 0
            AND entry_type = 'milk'
            AND milk_type = 'Mixed'
        )
    );

-- Optional provider details are encrypted by the API before storage, so TEXT
-- is required for the variable-length ciphertext. Existing profiles stay valid.
ALTER TABLE children
    ADD COLUMN IF NOT EXISTS pediatrician_contact_number TEXT,
    ADD COLUMN IF NOT EXISTS pediatrician_clinic_hospital TEXT,
    ADD COLUMN IF NOT EXISTS obgyne_contact_number TEXT;

-- Allergy and hereditary-condition records use the same optional supporting
-- photo/document flow as illnesses.
ALTER TABLE record_attachments
    DROP CONSTRAINT IF EXISTS record_attachments_record_type_check;

ALTER TABLE record_attachments
    ADD CONSTRAINT record_attachments_record_type_check
    CHECK (record_type IN (
        'vaccination', 'medication', 'illness', 'allergy', 'hereditary',
        'hospitalization', 'checkup'
    ));

-- Optional facts only: do not infer birth measurements or classify old allergies.
ALTER TABLE children ADD COLUMN IF NOT EXISTS birth_head_circumference DECIMAL(5,2);
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS allergy_type TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'children_birth_head_range'
                   AND conrelid = 'children'::regclass) THEN
        ALTER TABLE children ADD CONSTRAINT children_birth_head_range
            CHECK (birth_head_circumference BETWEEN 20 AND 65);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_history_allergy_type_check'
                   AND conrelid = 'medical_history'::regclass) THEN
        ALTER TABLE medical_history ADD CONSTRAINT medical_history_allergy_type_check
            CHECK (allergy_type IS NULL OR (category = 'Allergy' AND allergy_type IN ('food', 'non_food')));
    END IF;
END $$;

-- Notification receipts contain references/times, not copies of medical text.
CREATE TABLE IF NOT EXISTS notification_inbox_state (
    child_id INTEGER PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
    initialized_at TIMESTAMPTZ NOT NULL,
    synced_through TIMESTAMPTZ NOT NULL,
    time_zone TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('shared_access', 'course_ended', 'vaccination', 'appointment', 'medication_dose')),
    occurrence_key TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ,
    backfilled BOOLEAN NOT NULL DEFAULT FALSE,
    access_log_id INTEGER REFERENCES access_logs(id) ON DELETE CASCADE,
    vaccination_id INTEGER REFERENCES vaccinations(id) ON DELETE CASCADE,
    checkup_id INTEGER REFERENCES checkups(id) ON DELETE CASCADE,
    medication_id INTEGER REFERENCES medical_history(id) ON DELETE CASCADE,
    UNIQUE (child_id, occurrence_key),
    CHECK (num_nonnulls(access_log_id, vaccination_id, checkup_id, medication_id) = 1),
    CHECK ((kind = 'shared_access' AND access_log_id IS NOT NULL)
        OR (kind = 'vaccination' AND vaccination_id IS NOT NULL)
        OR (kind = 'appointment' AND checkup_id IS NOT NULL)
        OR (kind IN ('course_ended', 'medication_dose') AND medication_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_notifications_child_date ON notifications(child_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(child_id, occurred_at DESC, id DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_access ON notifications(access_log_id);
CREATE INDEX IF NOT EXISTS idx_notifications_vaccination ON notifications(vaccination_id);
CREATE INDEX IF NOT EXISTS idx_notifications_checkup ON notifications(checkup_id);
CREATE INDEX IF NOT EXISTS idx_notifications_medication ON notifications(medication_id);
ALTER TABLE notification_inbox_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notification_inbox_state, notifications FROM PUBLIC;
REVOKE ALL ON SEQUENCE notifications_id_seq FROM PUBLIC;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON notification_inbox_state, notifications FROM anon;
        REVOKE ALL ON SEQUENCE notifications_id_seq FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON notification_inbox_state, notifications FROM authenticated;
        REVOKE ALL ON SEQUENCE notifications_id_seq FROM authenticated;
    END IF;
END $$;

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

-- Rerun setup to check idempotence.
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

CREATE TABLE IF NOT EXISTS calendar_plan_statuses (
    id              SERIAL PRIMARY KEY,
    child_id        INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    source_type     VARCHAR(30) NOT NULL
                    CHECK (source_type IN ('vaccination', 'checkup', 'medical-history', 'calendar-event')),
    source_id       INTEGER NOT NULL CHECK (source_id > 0),
    occurrence_date DATE NOT NULL,
    completed       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (child_id, source_type, source_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_plan_statuses_child_date
    ON calendar_plan_statuses(child_id, occurrence_date DESC, id DESC);

DROP TRIGGER IF EXISTS trg_calendar_plan_statuses_updated ON calendar_plan_statuses;
CREATE TRIGGER trg_calendar_plan_statuses_updated BEFORE UPDATE ON calendar_plan_statuses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE calendar_plan_statuses ENABLE ROW LEVEL SECURITY;

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

-- Optional because older formula records have no reliable scoop count to
-- backfill. NUMERIC supports common half-scoop measurements without floating
-- point drift.
ALTER TABLE nutrition_records ADD COLUMN IF NOT EXISTS formula_scoops NUMERIC(5,2)
    CHECK (
        formula_scoops IS NULL OR (
            formula_scoops > 0
            AND entry_type = 'milk'
            AND milk_type IN ('Formula', 'Mixed')
        )
    );

-- Mixed bottles record formula and breastmilk separately. Nullable keeps
-- historical rows valid because their original split cannot be reconstructed.
ALTER TABLE nutrition_records ADD COLUMN IF NOT EXISTS breastmilk_quantity NUMERIC(7,2)
    CHECK (
        breastmilk_quantity IS NULL OR (
            breastmilk_quantity > 0
            AND entry_type = 'milk'
            AND milk_type = 'Mixed'
        )
    );

-- Optional provider details are encrypted by the API before storage, so TEXT
-- is required for the variable-length ciphertext. Existing profiles stay valid.
ALTER TABLE children
    ADD COLUMN IF NOT EXISTS pediatrician_contact_number TEXT,
    ADD COLUMN IF NOT EXISTS pediatrician_clinic_hospital TEXT,
    ADD COLUMN IF NOT EXISTS obgyne_contact_number TEXT;

-- Allergy and hereditary-condition records use the same optional supporting
-- photo/document flow as illnesses.
ALTER TABLE record_attachments
    DROP CONSTRAINT IF EXISTS record_attachments_record_type_check;

ALTER TABLE record_attachments
    ADD CONSTRAINT record_attachments_record_type_check
    CHECK (record_type IN (
        'vaccination', 'medication', 'illness', 'allergy', 'hereditary',
        'hospitalization', 'checkup'
    ));

-- Optional facts only: do not infer birth measurements or classify old allergies.
ALTER TABLE children ADD COLUMN IF NOT EXISTS birth_head_circumference DECIMAL(5,2);
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS allergy_type TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'children_birth_head_range'
                   AND conrelid = 'children'::regclass) THEN
        ALTER TABLE children ADD CONSTRAINT children_birth_head_range
            CHECK (birth_head_circumference BETWEEN 20 AND 65);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_history_allergy_type_check'
                   AND conrelid = 'medical_history'::regclass) THEN
        ALTER TABLE medical_history ADD CONSTRAINT medical_history_allergy_type_check
            CHECK (allergy_type IS NULL OR (category = 'Allergy' AND allergy_type IN ('food', 'non_food')));
    END IF;
END $$;

-- Notification receipts contain references/times, not copies of medical text.
CREATE TABLE IF NOT EXISTS notification_inbox_state (
    child_id INTEGER PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
    initialized_at TIMESTAMPTZ NOT NULL,
    synced_through TIMESTAMPTZ NOT NULL,
    time_zone TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('shared_access', 'course_ended', 'vaccination', 'appointment', 'medication_dose')),
    occurrence_key TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    read_at TIMESTAMPTZ,
    backfilled BOOLEAN NOT NULL DEFAULT FALSE,
    access_log_id INTEGER REFERENCES access_logs(id) ON DELETE CASCADE,
    vaccination_id INTEGER REFERENCES vaccinations(id) ON DELETE CASCADE,
    checkup_id INTEGER REFERENCES checkups(id) ON DELETE CASCADE,
    medication_id INTEGER REFERENCES medical_history(id) ON DELETE CASCADE,
    UNIQUE (child_id, occurrence_key),
    CHECK (num_nonnulls(access_log_id, vaccination_id, checkup_id, medication_id) = 1),
    CHECK ((kind = 'shared_access' AND access_log_id IS NOT NULL)
        OR (kind = 'vaccination' AND vaccination_id IS NOT NULL)
        OR (kind = 'appointment' AND checkup_id IS NOT NULL)
        OR (kind IN ('course_ended', 'medication_dose') AND medication_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_notifications_child_date ON notifications(child_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(child_id, occurred_at DESC, id DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_access ON notifications(access_log_id);
CREATE INDEX IF NOT EXISTS idx_notifications_vaccination ON notifications(vaccination_id);
CREATE INDEX IF NOT EXISTS idx_notifications_checkup ON notifications(checkup_id);
CREATE INDEX IF NOT EXISTS idx_notifications_medication ON notifications(medication_id);
ALTER TABLE notification_inbox_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notification_inbox_state, notifications FROM PUBLIC;
REVOKE ALL ON SEQUENCE notifications_id_seq FROM PUBLIC;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON notification_inbox_state, notifications FROM anon;
        REVOKE ALL ON SEQUENCE notifications_id_seq FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON notification_inbox_state, notifications FROM authenticated;
        REVOKE ALL ON SEQUENCE notifications_id_seq FROM authenticated;
    END IF;
END $$;

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

DO $$ DECLARE audit RECORD; after_hash TEXT; BEGIN
 FOR audit IN SELECT * FROM stage1_preservation_audit LOOP
  EXECUTE format('SELECT md5(COALESCE(jsonb_agg(jsonb_strip_nulls(to_jsonb(t)) ORDER BY to_jsonb(t)::text)::text,''[]'')) FROM public.%I t',audit.table_name) INTO after_hash;
  IF after_hash<>audit.fingerprint THEN RAISE EXCEPTION 'Preservation gate failed for %',audit.table_name; END IF;
 END LOOP;
END $$;
