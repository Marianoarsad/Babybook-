-- Optional parent-recorded category; never infer or backfill historical foods.
ALTER TABLE nutrition_records ADD COLUMN IF NOT EXISTS food_category TEXT;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nutrition_food_category_check'
        AND conrelid = 'nutrition_records'::regclass) THEN
        ALTER TABLE nutrition_records ADD CONSTRAINT nutrition_food_category_check
            CHECK (food_category IN ('fruits', 'vegetables', 'grains', 'proteins', 'dairy', 'other'));
    END IF;
END $$;
