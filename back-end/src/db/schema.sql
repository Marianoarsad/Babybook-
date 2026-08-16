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
DROP TABLE IF EXISTS medication_doses CASCADE;
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
    source        VARCHAR(20) NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'epi')),  -- 'epi' = auto-generated DOH schedule dose
    dose_number   INTEGER
                  CHECK (dose_number IS NULL OR (dose_number > 0 AND dose_number <= 10)),
    -- What happened after the dose. Recorded, never interpreted — see
    -- migrations/004_vaccination_detail.sql.
    reaction_severity VARCHAR(10)
                  CHECK (reaction_severity IN ('none', 'mild', 'severe')),
    reaction      TEXT,              -- encrypted at rest
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
    description   TEXT,              -- encrypted at rest
    date_recorded DATE,              -- started / admitted on
    resolved      BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_date DATE,              -- got better / discharged on
    -- Where the child was cared for. Illness rows only, and a record of what
    -- the family DID — not a severity rating. 'home' is not "mild".
    care_level    VARCHAR(20)
                  CHECK (care_level IN ('home', 'doctor', 'hospital')),
    facility      TEXT,              -- hospital / clinic name, encrypted at rest
    notes         TEXT,
    -- ---- Medication rows only (migration 006) ----
    -- How much per dose, as the parent was told: "5 mL", "1 tablet". Free text
    -- and never parsed, validated or converted — the app records what a doctor
    -- said and is not a pharmacist (PRODUCT.md Principle 5).
    dose_amount   TEXT,              -- encrypted at rest
    -- Structured, unlike the amount, so "2 of 3 doses today" is countable.
    frequency_per_day INTEGER
                  CHECK (frequency_per_day IS NULL OR (frequency_per_day > 0 AND frequency_per_day <= 12)),
    dose_times    JSONB,             -- ["08:00","14:00","20:00"] — the parent's chosen times
    course_days   INTEGER            -- NULL means ongoing / as needed
                  CHECK (course_days IS NULL OR (course_days > 0 AND course_days <= 365)),
    prescribed_by TEXT,              -- encrypted at rest
    -- Which illness this medicine is for. Self-referencing; SET NULL so
    -- removing the illness never takes the medicine record with it.
    treats_id     INTEGER REFERENCES medical_history(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_medical_history_child ON medical_history(child_id);
CREATE TRIGGER trg_medical_history_updated BEFORE UPDATE ON medical_history
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- MEDICATION DOSES — one row per dose actually given.
--
-- Without this the app can list what was prescribed but can never answer the
-- question a parent has three times a day. given_date / given_time are
-- separate columns (like nutrition_records): every date this app stores is a
-- plain local calendar date with no timezone.
-- =========================================================
CREATE TABLE medication_doses (
    id            SERIAL PRIMARY KEY,
    child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    medication_id INTEGER NOT NULL REFERENCES medical_history(id) ON DELETE CASCADE,
    given_date    DATE NOT NULL,
    given_time    TIME,
    notes         TEXT,              -- encrypted at rest
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_medication_doses_child ON medication_doses(child_id);
CREATE INDEX idx_medication_doses_med ON medication_doses(medication_id, given_date);

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
--   entry_type 'milk'  -> milk_type / feed_method, then either
--                         duration_minutes + breast_side ('breast')
--                         or quantity + unit + formula_brand ('bottle')
--   entry_type 'solid' -> food_introduced / reaction_severity / reaction
-- Stored per day (entry_date); edits overwrite in place (updated_at moves).
-- =========================================================
CREATE TABLE nutrition_records (
    id              SERIAL PRIMARY KEY,
    child_id        INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    entry_type      VARCHAR(10) NOT NULL DEFAULT 'milk'
                    CHECK (entry_type IN ('milk', 'solid')),
    -- milk fields
    milk_type       VARCHAR(20) CHECK (milk_type IN ('Formula', 'Breastmilk', 'Mixed')),
    -- How the milk was given. A breastfeed has no measurable volume, so
    -- requiring quantity for every milk row made the most common feeding
    -- pattern unrecordable. NULL means a pre-migration row.
    feed_method     VARCHAR(10) CHECK (feed_method IN ('breast', 'bottle')),
    formula_brand   TEXT,          -- encrypted at rest
    quantity        DECIMAL(7,2),  -- bottle feeds only
    unit            VARCHAR(5) CHECK (unit IN ('oz', 'mL', 'L')),
    -- Breastfeeds only, and optional: a parent logging a night feed hours
    -- later does not know the minutes, and requiring them would only swap an
    -- invented volume for an invented duration.
    duration_minutes INTEGER
                    CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 240)),
    -- Not collected by the app — cut from the form as a breastfeeding-tracker
    -- feature rather than a health-record one. Kept so it is reversible
    -- without a migration; expect NULL on every row.
    breast_side     VARCHAR(5) CHECK (breast_side IN ('left', 'right', 'both')),
    -- solid fields
    food_introduced TEXT,          -- encrypted at rest
    -- Whether there WAS a reaction, so it can be counted and filtered.
    -- `reaction` below is the free-text description of one.
    reaction_severity VARCHAR(10) CHECK (reaction_severity IN ('none', 'mild', 'severe')),
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
    access_date       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address        VARCHAR(45),     -- fits full IPv6; not encrypted, parent needs to read/group by it
    user_agent        TEXT,            -- not encrypted; operational metadata
    seen_by_parent    BOOLEAN NOT NULL DEFAULT FALSE
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
