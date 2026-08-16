-- Additive: make a medicine a course that can be tracked and finished, and
-- give the app somewhere to record each dose actually given.
--
-- Until now a medication row held a name and one free-text "dosage guidelines"
-- string, with the start date forced to today. There was no amount, no
-- frequency, no length, no way to say the course was done, and nowhere at all
-- to record that a dose had been given — while the tab was titled "Medication
-- Reminders" and the app had never scheduled one.
--
-- date_recorded (started on), resolved (course finished) and resolved_date
-- (finished on) are REUSED from migration 005 rather than duplicated here, and
-- `description` keeps its existing meaning as the instructions a parent was
-- given ("with food", "finish the whole course") — every existing row already
-- reads that way, so nothing is remapped.

-- How much per dose, exactly as the parent was told: "5 mL", "1 tablet",
-- "half a sachet". Free text and encrypted, like every other clinical field.
--
-- Deliberately NOT parsed, validated, converted between units, or compared
-- against anything. The app records what a doctor said; it is not a pharmacist
-- and must never behave like one (PRODUCT.md Principle 5).
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS dose_amount TEXT;

-- How many doses a day. Structured, unlike the amount, because "have I given
-- today's three doses?" has to be countable rather than parsed out of prose.
-- The ceiling is a sanity bound on a typo, not a clinical limit.
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS frequency_per_day INTEGER
    CHECK (frequency_per_day IS NULL OR (frequency_per_day > 0 AND frequency_per_day <= 12));

-- The times of day the PARENT chose to give it, e.g. ["08:00","14:00","20:00"].
-- Same jsonb idiom as calendar_events.reminder_settings. This is what the
-- rolling notification window is built from.
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS dose_times JSONB;

-- Planned length of the course in days. NULL means ongoing or as-needed, which
-- is a real answer and not a missing one — "Day 3 of 7" simply becomes "Day 3".
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS course_days INTEGER
    CHECK (course_days IS NULL OR (course_days > 0 AND course_days <= 365));

-- Who prescribed it. Encrypted, like every other free-text clinical field.
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS prescribed_by TEXT;

-- Which illness this medicine is for. Self-referencing, because an illness and
-- a medication are both medical_history rows. ON DELETE SET NULL: removing the
-- illness must not take the medicine record with it — what the child was given
-- stays true regardless.
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS treats_id INTEGER
    REFERENCES medical_history(id) ON DELETE SET NULL;

-- One row per dose actually given. The whole point of the feature: without it
-- the tab can list what was prescribed but can never answer the question a
-- parent actually has three times a day.
--
-- given_date and given_time are separate columns, matching nutrition_records.
-- Every date this app stores is a plain local calendar date with no timezone —
-- see the timezone note in CLAUDE.md section 8, and never reintroduce
-- toISOString().slice(0, 10) to mean "today".
CREATE TABLE IF NOT EXISTS medication_doses (
    id            SERIAL PRIMARY KEY,
    child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    medication_id INTEGER NOT NULL REFERENCES medical_history(id) ON DELETE CASCADE,
    given_date    DATE NOT NULL,
    given_time    TIME,
    notes         TEXT,              -- encrypted at rest
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medication_doses_child ON medication_doses(child_id);
CREATE INDEX IF NOT EXISTS idx_medication_doses_med ON medication_doses(medication_id, given_date);

-- No backfill for any of it.
--
-- Nothing was ever collected, so every existing medication genuinely has no
-- amount, no frequency and no course length, and no dose was ever recorded.
-- NULL is the honest answer, and the app renders it as "not recorded" rather
-- than inventing a schedule — which is exactly what the old
-- "Duration: As prescribed" fallback did on every row.
