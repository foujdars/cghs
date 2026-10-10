-- Enable Supabase Cron (pg_cron), pg_net, and Vault in Dashboard first.
-- Create TWO secrets in Dashboard > Vault:
-- slotcare_app_url = https://YOUR_PRODUCTION_APP.vercel.app (no trailing slash)
-- slotcare_cron_secret = the same CRON_SECRET used in Vercel
-- Calling cron.schedule with the same name updates the existing schedule.
select cron.schedule('slotcare-enqueue-checks','* * * * *',
 $$select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='slotcare_app_url') || '/api/cron',
   headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='slotcare_cron_secret')),
   body := '{}'::jsonb,
   timeout_milliseconds := 20000
 );$$
);
-- Inspect: select jobid,jobname,schedule,active from cron.job where jobname='slotcare-enqueue-checks';
-- Stop: select cron.unschedule('slotcare-enqueue-checks');
-- Clean up old completed checks daily; this contains no patient identifiers.
select cron.schedule('slotcare-prune-checks','17 0 * * *',
 $$delete from public.slotcare_jobs where state='done' and created_at < now()-interval '7 days';$$
);
