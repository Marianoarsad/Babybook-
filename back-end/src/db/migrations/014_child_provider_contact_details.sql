-- Optional provider details are encrypted by the API before storage, so TEXT
-- is required for the variable-length ciphertext. Existing profiles stay valid.
ALTER TABLE children
    ADD COLUMN IF NOT EXISTS pediatrician_contact_number TEXT,
    ADD COLUMN IF NOT EXISTS pediatrician_clinic_hospital TEXT,
    ADD COLUMN IF NOT EXISTS obgyne_contact_number TEXT;
