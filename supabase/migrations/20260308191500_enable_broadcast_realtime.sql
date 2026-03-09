-- Enable real-time replication for broadcast-related tables
BEGIN;
  -- Remove if already exists to avoid errors
  DO $$ 
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'system_config') THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.system_config;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'student_records') THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.student_records;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'daily_homework') THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.daily_homework;
    END IF;
  END $$;

  -- Add tables to the realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.system_config;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.student_records;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_homework;
COMMIT;
