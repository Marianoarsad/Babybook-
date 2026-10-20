-- Records are accessed through Express ownership checks, never the Supabase Data API.
-- Preserve owner/service access and Storage; do not FORCE RLS or change any row.
DO $$
DECLARE table_name TEXT; sequence_name TEXT; client_role TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users','user_auth_identities','password_resets','children','vaccinations',
        'checkups','medical_history','medication_doses','growth_records','milestones',
        'nutrition_records','memories','reminders','calendar_events','calendar_plan_statuses',
        'shared_records','access_logs','notification_inbox_state','notifications',
        'record_attachments','mutation_receipts','consultation_access_limits',
        'feed_logs','sleep_logs','temperature_logs','schema_migrations'
    ] LOOP
        IF to_regclass(format('public.%I', table_name)) IS NULL THEN CONTINUE; END IF;
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
        FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, client_role);
        END LOOP;
        FOR sequence_name IN
            SELECT format('%I.%I', n.nspname, s.relname)
            FROM pg_class s JOIN pg_namespace n ON n.oid=s.relnamespace
            JOIN pg_depend d ON d.objid=s.oid AND d.deptype IN ('a','i')
            WHERE s.relkind='S' AND d.refobjid=to_regclass(format('public.%I', table_name))
        LOOP
            EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC', sequence_name);
            FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
                EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM %I', sequence_name, client_role);
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- New public tables created by this migration role should also start server-only.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
DO $$ DECLARE client_role TEXT; BEGIN
    FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', client_role);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', client_role);
    END LOOP;
END $$;
