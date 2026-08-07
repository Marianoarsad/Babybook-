-- Additive: apply the calendar_events table to an existing database without
-- touching any other table. Mirrors schema.sql exactly (source of truth for
-- fresh databases); this file is what applies it to a live database that
-- already has data, since running schema.sql wholesale would drop everything.

CREATE TABLE IF NOT EXISTS calendar_events (
    id                SERIAL PRIMARY KEY,
    child_id          INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,          -- encrypted at rest
    description       TEXT,
    event_type        VARCHAR(50) NOT NULL DEFAULT 'custom',
    event_date        DATE NOT NULL,
    event_time        TIME,
    reminder_settings JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_child ON calendar_events(child_id);

DROP TRIGGER IF EXISTS trg_calendar_events_updated ON calendar_events;
CREATE TRIGGER trg_calendar_events_updated BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
