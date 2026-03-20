DO $$
BEGIN
    -- Insert into users if it exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        INSERT INTO public.users (id, username, role, display_name, created_at)
        VALUES ('00000000-0000-0000-0000-000000000000', 'system_default', 'user', '系統預設 (Master Default)', NOW())
        ON CONFLICT (id) DO UPDATE SET display_name = '系統預設 (Master Default)';
    END IF;

    -- Insert into user_profiles if it exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
        INSERT INTO public.user_profiles (id, display_name, created_at)
        VALUES ('00000000-0000-0000-0000-000000000000', '系統預設 (Master Default)', NOW())
        ON CONFLICT (id) DO UPDATE SET display_name = '系統預設 (Master Default)';
    END IF;
END $$;
