-- Additive: make a direct breastfeed recordable, and make a food reaction
-- answerable as data.
--
-- Before this, every milk entry required a quantity in mL/oz. A parent
-- feeding at the breast has no volume to enter, so the app's most common
-- feeding pattern could only be recorded by inventing a number or skipping
-- the record. `feed_method` splits the two cases: a breastfeed records how
-- long and which side, a bottle records how much.
ALTER TABLE nutrition_records ADD COLUMN IF NOT EXISTS feed_method VARCHAR(10)
    CHECK (feed_method IN ('breast', 'bottle'));
-- Nullable on purpose: a parent logging a 3am feed at 7am does not know
-- whether it ran 12 minutes or 22, and requiring a number would only swap an
-- invented volume for an invented duration.
ALTER TABLE nutrition_records ADD COLUMN IF NOT EXISTS duration_minutes INTEGER
    CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 240));
-- Which breast was fed from. The app does NOT currently collect this — the
-- field was cut from the form as a breastfeeding-tracker feature rather than
-- a child-health-record one, and nothing downstream consumed it. The column
-- stays so the decision is reversible without another migration; expect it to
-- be NULL on every row.
ALTER TABLE nutrition_records ADD COLUMN IF NOT EXISTS breast_side VARCHAR(5)
    CHECK (breast_side IN ('left', 'right', 'both'));

-- The free-text `reaction` column stays, as the description of what happened.
-- This one records WHETHER there was a reaction, so "has this child ever
-- reacted to a food?" stops requiring a human to read every row. The old
-- column held values like "None", "none" and "" interchangeably.
ALTER TABLE nutrition_records ADD COLUMN IF NOT EXISTS reaction_severity VARCHAR(10)
    CHECK (reaction_severity IN ('none', 'mild', 'severe'));

-- Backfills. Both are exact-match only — nothing here interprets free text.

-- A row carrying a recorded volume was measured, which means a bottle.
UPDATE nutrition_records SET feed_method = 'bottle'
    WHERE entry_type = 'milk' AND feed_method IS NULL AND quantity IS NOT NULL;

-- Only the literal "None" is safe to read as "no reaction". Anything else
-- stays NULL, which the app renders as "not recorded" rather than guessing.
--
-- Note this reaches seeded rows only. `reaction` is encrypted at rest for
-- anything saved through the API (values look like 'enc:v1:...'), and SQL
-- cannot decrypt it — the key lives in the app. Those rows keep a NULL
-- severity, which is the honest answer: nobody recorded one in the
-- structured field, and inventing it from ciphertext is not possible or
-- desirable. The app shows the free text alongside, so nothing is lost.
UPDATE nutrition_records SET reaction_severity = 'none'
    WHERE entry_type = 'solid' AND reaction_severity IS NULL
      AND lower(trim(reaction)) = 'none';
