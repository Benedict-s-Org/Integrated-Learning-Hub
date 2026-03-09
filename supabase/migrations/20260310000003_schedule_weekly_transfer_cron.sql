-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Check if the cron job already exists and unschedule it to prevent duplicates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-toilet-coin-transfer') THEN
    PERFORM cron.unschedule('weekly-toilet-coin-transfer');
  END IF;
END $$;

-- Schedule the weekly transfer for Sunday at 12:00 AM (midnight) HK Time
-- Note: pg_cron uses GMT/UTC. Hong Kong is UTC+8.
-- So Sunday 00:00 HK time is Saturday 16:00 UTC.
SELECT cron.schedule(
  'weekly-toilet-coin-transfer',
  '0 16 * * 6', 
  $$ SELECT public.transfer_toilet_coins_weekly(); $$
);
