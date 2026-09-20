-- Optional because older formula records have no reliable scoop count to
-- backfill. NUMERIC supports common half-scoop measurements without floating
-- point drift.
ALTER TABLE nutrition_records ADD COLUMN IF NOT EXISTS formula_scoops NUMERIC(5,2)
    CHECK (
        formula_scoops IS NULL OR (
            formula_scoops > 0
            AND entry_type = 'milk'
            AND milk_type IN ('Formula', 'Mixed')
        )
    );
