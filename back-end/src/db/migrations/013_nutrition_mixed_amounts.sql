-- Mixed bottles record formula and breastmilk separately. Nullable keeps
-- historical rows valid because their original split cannot be reconstructed.
ALTER TABLE nutrition_records ADD COLUMN IF NOT EXISTS breastmilk_quantity NUMERIC(7,2)
    CHECK (
        breastmilk_quantity IS NULL OR (
            breastmilk_quantity > 0
            AND entry_type = 'milk'
            AND milk_type = 'Mixed'
        )
    );
