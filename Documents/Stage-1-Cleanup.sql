-- BabyBook+ mock rollout: run ONLY after preservation tests and two successful test schedules.
-- This enables a persistent five-minute job. It never deletes original records or share rows.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE filename='018_qr_web_sharing.sql') THEN
        RAISE EXCEPTION 'Apply and verify migration 018 before enabling cleanup';
    END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    IF (SELECT count(*) FROM cron.job WHERE jobname='babybook_share_snapshot_cleanup') > 1
       OR EXISTS (SELECT 1 FROM cron.job WHERE jobname='babybook_share_snapshot_cleanup'
          AND command <> 'SELECT public.babybook_share_snapshot_cleanup();') THEN
        RAISE EXCEPTION 'Existing job does not match this cleanup; stop and inspect it';
    END IF;
END $$;

SELECT cron.schedule('babybook_share_snapshot_cleanup', '*/5 * * * *',
    'SELECT public.babybook_share_snapshot_cleanup();');

SELECT jobid, jobname, schedule, active FROM cron.job
 WHERE jobname='babybook_share_snapshot_cleanup';

-- Monitor (metadata only):
-- SELECT status, start_time, end_time, return_message FROM cron.job_run_details
-- WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname='babybook_share_snapshot_cleanup')
-- ORDER BY start_time DESC LIMIT 5;
-- Pause only this job (do not disable the extension: that removes unrelated jobs):
-- SELECT cron.alter_job(jobid, active := false) FROM cron.job
-- WHERE jobname='babybook_share_snapshot_cleanup';
