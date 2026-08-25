-- Additive: make "which dose is this?" a real field, and let a parent record
-- what happened after a shot.
--
-- Which dose in a series. Until now this lived inside the encrypted
-- `vaccine_name` as a trailing digit ("Pentavalent (DTwP-HepB-Hib) 2"), which
-- meant "is dose 2 done?" was a string match on ciphertext the database cannot
-- read. Nullable because a single-dose vaccine has no dose number, and because
-- rows created before this migration have none.
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS dose_number INTEGER
    CHECK (dose_number IS NULL OR (dose_number > 0 AND dose_number <= 10));

-- What happened after the dose. A reaction is the one clinically meaningful
-- thing a parent is genuinely well placed to observe, and the app had nowhere
-- to put it — so it reached neither the record nor the healthcare professional
-- reading the QR snapshot.
--
-- Same two-column shape as nutrition_records: severity is the structured value
-- the app counts and filters on, `reaction` is only the description of one.
-- Deliberately NOT a judgement — the app records it and never interprets it,
-- never writes it into children.allergies, and never advises on a later dose.
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS reaction_severity VARCHAR(10)
    CHECK (reaction_severity IN ('none', 'mild', 'severe'));
-- Encrypted at rest by the app (values look like 'enc:v1:...'), like every
-- other free-text clinical field.
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS reaction TEXT;

-- No backfill for dose_number.
--
-- The digit that would populate it sits inside `vaccine_name`, which is
-- encrypted — the key lives in the app, so SQL cannot read it. Guessing from
-- ciphertext is neither possible nor desirable. Existing rows keep NULL, which
-- the app renders as "not recorded"; regenerating the DOH schedule fills the
-- column for auto-generated doses, and the dedupe in utils/epiGenerator.js
-- compares names with the trailing dose digit stripped so that regeneration
-- updates rather than duplicates.
--
-- No backfill for reaction_severity either: nothing was ever recorded, so
-- every existing row genuinely has no answer. NULL is that answer.
