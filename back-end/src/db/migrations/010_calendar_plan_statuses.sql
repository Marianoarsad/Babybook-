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
