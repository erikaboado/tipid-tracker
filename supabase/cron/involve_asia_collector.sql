-- Schedules the involve-asia-collector Edge Function every 6 hours with pg_cron + pg_net.
-- Run this once in the Supabase SQL editor AFTER deploying the function. Not a migration,
-- because it needs your project URL and cron secret (kept in Vault, never in git).
--
-- 1. Dashboard → Database → Extensions: enable pg_cron and pg_net.
-- 2. Store the two values in Vault (replace the placeholders, run once):
--      select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'project_url');
--      select vault.create_secret('SAME-VALUE-AS-COLLECTOR_CRON_SECRET', 'collector_cron_secret');
-- 3. Run the statement below.

select cron.schedule(
  'involve-asia-collector',
  '0 */6 * * *', -- every 6 hours (UTC)
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/involve-asia-collector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'collector_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Check runs:   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'involve-asia-collector') order by start_time desc limit 10;
-- Responses:    select status_code, content from net._http_response order by created desc limit 5;
-- Stop it:      select cron.unschedule('involve-asia-collector');
