-- Migration: Create System Default User
-- Description: Inserts a dummy user with ID 00000000-0000-0000-0000-000000000000 to satisfy foreign key constraints.
-- NOTE: We do NOT insert into auth.users here because the auth→public sync trigger would fire
-- and conflict with the row already inserted by 20260224041000_create_system_default_user.sql.
-- This user is a FK placeholder only and does not need an auth login.

DO $$
BEGIN
  -- Insert into public.users using ON CONFLICT to be fully idempotent
  INSERT INTO public.users (id, username, password_hash, role, display_name)
  VALUES ('00000000-0000-0000-0000-000000000000', 'system@default.local', 'placeholder_hash', 'user', '系統預設藍圖')
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;
END $$;
