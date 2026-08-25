-- Additive: let an illness or a hospital stay actually END, and record where
-- the child was cared for.
--
-- When it was over. `resolved` is a bare boolean, and the app writes it FALSE
-- at creation and has never had any way to set it TRUE — no edit path for
-- medical_history exists in the client at all. So every cold a child has ever
-- had still reads as happening now: the Dashboard's Needs Attention card, the
-- sibling alert dot, and the "Unresolved:" line at the top of the healthcare
-- professional's QR view all take that boolean at its word. Adding the date
-- alongside it is what makes "better now" and "better since the 16th" two
-- different facts instead of one.
--
-- For a hospitalization this is the discharge date. Same column, same meaning:
-- the day this stopped being true.
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS resolved_date DATE;

-- Where the child was cared for. Illness rows only.
--
-- This is a fact about what the family DID, not a severity rating. The app
-- does not grade how bad an illness was and must not start: 'home' is not
-- "mild" and 'hospital' is not "severe". A parent who took their child to a
-- doctor for a cough is recording a visit, not a diagnosis.
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS care_level VARCHAR(20)
    CHECK (care_level IN ('home', 'doctor', 'hospital'));

-- Which hospital or clinic. Encrypted at rest by the app (values look like
-- 'enc:v1:...') because it locates a real family at a real place on a real
-- date — the same reasoning that encrypts `title`.
--
-- Deliberately its own column rather than reusing the unused `notes`. Stuffing
-- a distinct fact into a general-purpose text column is exactly what made
-- "which dose is this?" a string match on ciphertext before migration 004.
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS facility TEXT;

-- No backfill for any of the three.
--
-- resolved_date: rows marked resolved before this migration cannot exist —
-- nothing could set `resolved` to TRUE — so there is no date to recover. Rows
-- that are genuinely still ongoing correctly have none.
--
-- care_level and facility: never collected, so every existing row genuinely
-- has no answer. NULL is that answer, and the app renders it as "not
-- recorded" rather than guessing 'home'.
