-- The account holder's profile: who they are to the child, and where they are.
--
-- The Create an Account form collected a full name, an email, a password, and
-- one toggle offering "Female (Mama)" or "Male (Papa)". That toggle wrote
-- users.gender, and gender had exactly one use anywhere in the codebase:
-- printing "Primary Guardian (Female)" on Edit Profile and a bare "Female" row
-- on View Profile. It answered no question the app asks.

-- Who this person is to the child.
--
-- The app calls the account holder the "Primary Guardian" on every screen, and
-- then made them choose between Mama and Papa. In a Filipino household the
-- person holding the record is frequently a lola, a tita, or an older sibling,
-- and the form gave them no way to say so — they had to pick a gender to stand
-- in for a relationship, and the app displayed the substitution as fact.
--
-- Plaintext, deliberately. Following the rule migrations 004 and 005 set for
-- dose_number and care_level: a short closed set stays readable so the CHECK
-- below is enforceable. SQL cannot constrain a value it cannot decrypt.
--
-- This is a family role, never a legal or custodial status. The app must not
-- rank these values, gate any feature on them, or treat 'guardian' as carrying
-- less authority over the record than 'mother'. Every one of them is the
-- account holder.
ALTER TABLE users ADD COLUMN IF NOT EXISTS relationship VARCHAR(20)
    CHECK (relationship IN ('mother', 'father', 'grandparent', 'guardian', 'other'));

-- The city or municipality the family lives in.
--
-- Edit Profile has shown a "Home City / Region" box since it was written, but
-- the value went to localStorage under bb_parent_city and was read back only by
-- the screen that wrote it — one producer, one consumer, the same file. It
-- never reached the server, never synced to a second device, and pre-filled
-- with "Quezon City, NCR" for every parent in the world.
--
-- Encrypted at rest by the app (values look like 'enc:v1:...'), matching
-- phone_number beside it and children.place_of_birth: free text that locates a
-- specific family is not something this database should hold in the clear.
-- TEXT, not VARCHAR, because ciphertext is longer than the plaintext it
-- replaces — the same reason every encrypted column in this schema is TEXT.
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;

-- gender is retired, not replaced.
--
-- relationship is NOT a renamed gender and is not backfilled from it. "Female"
-- does not mean "mother" — the whole reason for this migration is that the app
-- was treating those as the same fact. Guessing the mapping would write an
-- invented relationship into every existing account and make it indisputable
-- from an answer nobody gave. Existing users see the field empty and are asked
-- once, the same choice 005 and 007 made for their own new columns.
ALTER TABLE users DROP COLUMN IF EXISTS gender;
