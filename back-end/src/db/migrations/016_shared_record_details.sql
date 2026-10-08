-- Optional facts only: do not infer birth measurements or classify old allergies.
ALTER TABLE children ADD COLUMN IF NOT EXISTS birth_head_circumference DECIMAL(5,2);
ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS allergy_type TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'children_birth_head_range'
                   AND conrelid = 'children'::regclass) THEN
        ALTER TABLE children ADD CONSTRAINT children_birth_head_range
            CHECK (birth_head_circumference BETWEEN 20 AND 65);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_history_allergy_type_check'
                   AND conrelid = 'medical_history'::regclass) THEN
        ALTER TABLE medical_history ADD CONSTRAINT medical_history_allergy_type_check
            CHECK (allergy_type IS NULL OR (category = 'Allergy' AND allergy_type IN ('food', 'non_food')));
    END IF;
END $$;
