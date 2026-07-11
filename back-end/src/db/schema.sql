-- BabyBook+ database schema (PostgreSQL)
-- Refined from the Chapter 3 ERD: the paper's 12 tables, built with structured
-- columns, constraints, cascades and indexes, plus daily-tracker tables
-- (feed/sleep/temperature) and a password-reset table.
--
-- Safe to re-run: drops and recreates everything.

DROP TABLE IF EXISTS access_logs CASCADE;
DROP TABLE IF EXISTS shared_records CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS record_attachments CASCADE;
DROP TABLE IF EXISTS memories CASCADE;
DROP TABLE IF EXISTS nutrition_records CASCADE;
DROP TABLE IF EXISTS milestones CASCADE;
DROP TABLE IF EXISTS growth_records CASCADE;
DROP TABLE IF EXISTS medical_history CASCADE;
DROP TABLE IF EXISTS checkups CASCADE;
DROP TABLE IF EXISTS vaccinations CASCADE;
DROP TABLE IF EXISTS children CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Auto-update updated_at on row changes.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- USERS (parents / guardians) — the only account-holding actor.
-- Healthcare professionals access via QR only and have no account.
-- =========================================================
CREATE TABLE users (
    id                  SERIAL PRIMARY KEY,
    full_name           TEXT NOT NULL,          -- encrypted at rest (enc:v1:...)
    email               VARCHAR(100) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    phone_number        TEXT,                   -- encrypted at rest
    gender              VARCHAR(10),
    avatar_url          TEXT,
    -- Data-retention consent (Data Privacy Act of 2012, RA 10173).
    consent_accepted    BOOLEAN NOT NULL DEFAULT FALSE,
    consent_date        TIMESTAMPTZ,     -- when consent was first given
    consent_reviewed_at TIMESTAMPTZ,     -- last annual re-consent
    retention_until     DATE,            -- informational initial retention (~6 yrs); NOT an auto-delete trigger
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE password_resets (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_resets_token ON password_resets(token);

-- =========================================================
-- CHILDREN — structured birth + healthcare info.
-- =========================================================
CREATE TABLE children (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Sensitive identity/medical text below is encrypted at rest (enc:v1:...),
    -- so these columns are TEXT to hold variable-length ciphertext.
    first_name              TEXT NOT NULL,
    last_name               TEXT,
    nickname                TEXT,
    date_of_birth           DATE,
    time_of_birth           TIME,
    sex                     VARCHAR(10),
    blood_type              TEXT,
    birth_weight            DECIMAL(5,2),
    birth_length            DECIMAL(5,2),
    place_of_birth          TEXT,
    hospital                TEXT,
    obgyne_name             TEXT,
    pediatrician_name       TEXT,
    emergency_contact       TEXT,
    preferred_health_center TEXT,
    avatar_url              TEXT,
    allergies               JSONB NOT NULL DEFAULT '[]',
    hereditary_conditions   JSONB NOT NULL DEFAULT '[]',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_children_user ON children(user_id);
CREATE TRIGGER trg_children_updated BEFORE UPDATE ON children
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- VACCINATIONS — supports scheduled/due vs. completed.
-- =========================================================
CREATE TABLE vaccinations (
    id            SERIAL PRIMARY KEY,
    child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    vaccine_name  TEXT NOT NULL,     -- encrypted at rest
    visit_name    TEXT,              -- encrypted at rest
    due_date      DATE,
    date_given    DATE,
    status        VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'completed')),
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vaccinations_child ON vaccinations(child_id);
CREATE TRIGGER trg_vaccinations_updated BEFORE UPDATE ON vaccinations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- CHECKUPS — covers past checkups and future appointments via status.
-- =========================================================
CREATE TABLE checkups (
    id            SERIAL PRIMARY KEY,
    child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    title         TEXT,              -- encrypted at rest
    checkup_date  DATE,
    time_of_visit TIME,
    doctor_name   TEXT,              -- encrypted at rest
    clinic        TEXT,              -- encrypted at rest
    status        VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'completed')),
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkups_child ON checkups(child_id);
CREATE TRIGGER trg_checkups_updated BEFORE UPDATE ON checkups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- MEDICAL HISTORY — illnesses, allergies, medications, etc.
-- =========================================================
CREATE TABLE medical_history (
    id            SERIAL PRIMARY KEY,
    child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    category      VARCHAR(50) NOT NULL
                  CHECK (category IN ('Illness', 'Allergy', 'Medication', 'Hospitalization', 'Hereditary Condition')),
    title         TEXT,              -- encrypted at rest
    description   TEXT,
    date_recorded DATE,
    resolved      BOOLEAN NOT NULL DEFAULT FALSE,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_medical_history_child ON medical_history(child_id);
CREATE TRIGGER trg_medical_history_updated BEFORE UPDATE ON medical_history
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- GROWTH RECORDS — includes head circumference.
-- =========================================================
CREATE TABLE growth_records (
    id                 SERIAL PRIMARY KEY,
    child_id           INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    height             DECIMAL(5,2),
    weight             DECIMAL(5,2),
    head_circumference DECIMAL(5,2),
    date_recorded      DATE NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_growth_child ON growth_records(child_id);

-- =========================================================
-- MILESTONES
-- =========================================================
CREATE TABLE milestones (
    id            SERIAL PRIMARY KEY,
    child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,     -- encrypted at rest
    age_achieved  TEXT,              -- encrypted at rest
    description   TEXT,
    date_recorded DATE,
    is_completed  BOOLEAN NOT NULL DEFAULT TRUE,
    photo_url     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_milestones_child ON milestones(child_id);
CREATE TRIGGER trg_milestones_updated BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- NUTRITION RECORDS — unified milk + solid-food tracker.
--   entry_type 'milk'  -> milk_type / formula_brand / quantity / unit
--   entry_type 'solid' -> food_introduced / reaction
-- Stored per day (entry_date); edits overwrite in place (updated_at moves).
-- =========================================================
CREATE TABLE nutrition_records (
    id              SERIAL PRIMARY KEY,
    child_id        INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    entry_type      VARCHAR(10) NOT NULL DEFAULT 'milk'
                    CHECK (entry_type IN ('milk', 'solid')),
    -- milk fields
    milk_type       VARCHAR(20) CHECK (milk_type IN ('Formula', 'Breastmilk', 'Mixed')),
    formula_brand   TEXT,          -- encrypted at rest
    quantity        DECIMAL(7,2),
    unit            VARCHAR(5) CHECK (unit IN ('oz', 'mL', 'L')),
    -- solid fields
    food_introduced TEXT,          -- encrypted at rest
    reaction        TEXT,          -- encrypted at rest
    -- shared
    entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_time      TIME,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrition_child ON nutrition_records(child_id);
CREATE INDEX idx_nutrition_date ON nutrition_records(child_id, entry_date);
CREATE TRIGGER trg_nutrition_updated BEFORE UPDATE ON nutrition_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- MEMORIES — photo_url points to a locally stored file.
-- =========================================================
CREATE TABLE memories (
    id            SERIAL PRIMARY KEY,
    child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    photo_url     TEXT,
    caption       TEXT,              -- encrypted at rest
    notes         TEXT,
    date_recorded DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_memories_child ON memories(child_id);

-- =========================================================
-- REMINDERS — optionally linked to a specific vaccination/checkup.
-- =========================================================
CREATE TABLE reminders (
    id             SERIAL PRIMARY KEY,
    child_id       INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    reminder_type  VARCHAR(50) NOT NULL CHECK (reminder_type IN ('Vaccination', 'Checkup')),
    title          TEXT,              -- encrypted at rest
    reminder_date  DATE NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Pending', 'Completed')),
    vaccination_id INTEGER REFERENCES vaccinations(id) ON DELETE SET NULL,
    checkup_id     INTEGER REFERENCES checkups(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reminders_child ON reminders(child_id);
CREATE TRIGGER trg_reminders_updated BEFORE UPDATE ON reminders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- CALENDAR EVENTS — user-created custom entries only. Vaccinations,
-- checkups, medical history and reminders are aggregated for display
-- directly from their own tables, not duplicated here.
-- =========================================================
CREATE TABLE calendar_events (
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
CREATE INDEX idx_calendar_events_child ON calendar_events(child_id);
CREATE TRIGGER trg_calendar_events_updated BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- SHARED RECORDS (QR consultation access)
-- =========================================================
CREATE TABLE shared_records (
    id                 SERIAL PRIMARY KEY,
    child_id           INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    code               VARCHAR(20) NOT NULL UNIQUE,
    qr_payload         VARCHAR(255),
    shared_record_keys JSONB NOT NULL,
    payload            JSONB NOT NULL,
    generate_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expiration_date    TIMESTAMPTZ NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'expired', 'revoked')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shared_child ON shared_records(child_id);
CREATE INDEX idx_shared_code ON shared_records(code);

-- =========================================================
-- ACCESS LOG — every professional view of shared records.
-- =========================================================
CREATE TABLE access_logs (
    id                SERIAL PRIMARY KEY,
    share_id          INTEGER REFERENCES shared_records(id) ON DELETE CASCADE,
    child_id          INTEGER REFERENCES children(id) ON DELETE CASCADE,
    code              VARCHAR(20),
    professional_name VARCHAR(100),
    action            VARCHAR(50),
    access_date       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_access_share ON access_logs(share_id);
CREATE INDEX idx_access_child ON access_logs(child_id);

-- =========================================================
-- RECORD ATTACHMENTS — supporting photo/document per health record.
-- Polymorphic: record_id points to vaccinations / checkups / medical_history
-- depending on record_type. Cleaned up with the child (cascade) or on record
-- delete (handled in the attachments route).
-- =========================================================
CREATE TABLE record_attachments (
    id           SERIAL PRIMARY KEY,
    child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    record_type  VARCHAR(20) NOT NULL
                 CHECK (record_type IN ('vaccination', 'medication', 'illness', 'hospitalization', 'checkup')),
    record_id    INTEGER NOT NULL,
    file_url     TEXT NOT NULL,
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attach_record ON record_attachments(record_type, record_id);
CREATE INDEX idx_attach_child ON record_attachments(child_id);
