-- Migration: Create System Default User
-- Description: Inserts a dummy user with ID 00000000-0000-0000-0000-000000000000 to satisfy foreign key constraints.

DO $$
BEGIN
  -- 1. Insert into auth.users if not present
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000000') THEN
    INSERT INTO auth.users (id, aud, role, email, created_at, updated_at) 
    VALUES ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'system@default.local', NOW(), NOW());
  END IF;

  -- 2. Insert into public.users if not present
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = '00000000-0000-0000-0000-000000000000') THEN
    INSERT INTO public.users (id, username, password_hash, role, display_name) 
    VALUES ('00000000-0000-0000-0000-000000000000', 'system@default.local', 'placeholder_hash', 'user', '系統預設藍圖');
  END IF;
END $$;
