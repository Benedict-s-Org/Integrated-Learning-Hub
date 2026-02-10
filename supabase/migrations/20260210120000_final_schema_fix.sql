-- Final schema fix for user_room_data
-- Ensures all columns required for rewards and morning duties exist.

DO $$ 
BEGIN
    -- Add virtual_coins if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_room_data' AND column_name = 'virtual_coins') THEN
        ALTER TABLE public.user_room_data ADD COLUMN virtual_coins INTEGER DEFAULT 0;
    END IF;

    -- Add daily_counts if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_room_data' AND column_name = 'daily_counts') THEN
        ALTER TABLE public.user_room_data ADD COLUMN daily_counts JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add morning_status if missing (just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_room_data' AND column_name = 'morning_status') THEN
        ALTER TABLE public.user_room_data ADD COLUMN morning_status TEXT DEFAULT 'todo';
    END IF;

    -- Add last_morning_update if missing (just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_room_data' AND column_name = 'last_morning_update') THEN
        ALTER TABLE public.user_room_data ADD COLUMN last_morning_update DATE;
    END IF;
END $$;
