-- Explicit periods are independent of feeding events; never backfill inferred history.
CREATE TABLE milk_type_periods (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    milk_type TEXT NOT NULL CHECK (milk_type IN ('Breastmilk', 'Formula', 'Mixed')),
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_milk_type_periods_child_start ON milk_type_periods(child_id, start_date DESC, id DESC);
CREATE TRIGGER trg_milk_type_periods_updated BEFORE UPDATE ON milk_type_periods
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE milk_type_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE milk_type_periods FROM PUBLIC;
REVOKE ALL ON SEQUENCE milk_type_periods_id_seq FROM PUBLIC;
DO $$ DECLARE client_role TEXT; BEGIN
    FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
        EXECUTE format('REVOKE ALL ON TABLE milk_type_periods FROM %I', client_role);
        EXECUTE format('REVOKE ALL ON SEQUENCE milk_type_periods_id_seq FROM %I', client_role);
    END LOOP;
END $$;
