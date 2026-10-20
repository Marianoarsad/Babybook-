-- Nullable for existing records and older clients; do not guess saved categories.
ALTER TABLE memories ADD COLUMN IF NOT EXISTS development_category TEXT
    CHECK (development_category IN ('social', 'language', 'cognitive', 'motor'));
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS development_category TEXT
    CHECK (development_category IN ('social', 'language', 'cognitive', 'motor'));
