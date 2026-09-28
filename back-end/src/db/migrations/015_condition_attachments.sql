-- Allergy and hereditary-condition records use the same optional supporting
-- photo/document flow as illnesses.
ALTER TABLE record_attachments
    DROP CONSTRAINT IF EXISTS record_attachments_record_type_check;

ALTER TABLE record_attachments
    ADD CONSTRAINT record_attachments_record_type_check
    CHECK (record_type IN (
        'vaccination', 'medication', 'illness', 'allergy', 'hereditary',
        'hospitalization', 'checkup'
    ));
