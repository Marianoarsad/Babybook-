-- Additive: record the CIRCUMSTANCES of a growth measurement, not just the
-- number.
--
-- growth_records has carried four columns since the first schema — height,
-- weight, head_circumference, date_recorded — and the form that writes them
-- asked for three of the four. The date was hard-coded to today, so a clinic
-- weigh-in entered two days later was stored two days late. That is not a
-- cosmetic slip here: WHO's tables are indexed per day of age, so the stored
-- date is what decides the percentile the parent sees, the point's position on
-- the chart, and what the healthcare professional reads in the QR snapshot.
-- The date column already existed; the form now asks for it.
--
-- These two columns are what the table was actually missing.

-- Where the measurement was taken.
--
-- A bathroom scale and a health-centre beam balance are different
-- instruments, and a clinician reading a series has no way to tell which
-- produced a value. Recording it makes the series interpretable BY THE PERSON
-- QUALIFIED TO INTERPRET IT.
--
-- This is a record of where the family went — never a quality, accuracy or
-- confidence grade. Exactly the rule migration 005 set for care_level: 'home'
-- is not "less reliable" and 'hospital' is not "more reliable". The app must
-- not weight, rank, discount, annotate or colour a measurement based on this
-- column, and must never tell a parent their home measurement counts for less.
ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS measured_at VARCHAR(20)
    CHECK (measured_at IN ('home', 'health_center', 'clinic', 'hospital'));

-- The parent's own note about this measurement. "Weighed with clothes on",
-- "just after a feed", "the nurse used a different scale".
--
-- growth_records was the ONLY record type in the app with nowhere to write a
-- sentence. Encrypted at rest by the app (values look like 'enc:v1:...'), for
-- the same reason medical_history.notes is: free text a parent writes about
-- their child's body is not something this database should hold in the clear.
--
-- Deliberately NOT sent to the healthcare professional in the QR snapshot.
-- The clinical extract carries the measurement and where it was taken; the
-- parent's private aside stays with the parent, the same boundary already
-- drawn for milestone photos and descriptions.
ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS notes TEXT;

-- measured_at stays OUT of the app's encrypted column list, for the reason
-- recorded for dose_number (004) and care_level (005): SQL cannot filter,
-- group or CHECK a value it cannot read. The constraint above is only
-- enforceable because the column is plaintext.

-- No backfill for either column.
--
-- Neither fact was ever collected, so every existing row genuinely has no
-- answer. NULL is that answer and the app renders it as "not recorded" rather
-- than guessing 'home' — the same choice 005 made, and for the same reason: a
-- guessed provenance is worse than an admitted absence, because it looks
-- exactly like a recorded one.
