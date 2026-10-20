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
