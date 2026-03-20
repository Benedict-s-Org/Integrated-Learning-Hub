DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'phonics_sounds') THEN
        ALTER TABLE public.phonics_sounds ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;
    END IF;
END $$;
