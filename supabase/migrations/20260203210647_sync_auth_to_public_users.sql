-- Migration: Sync Auth Users to Public Users
-- This restores the synchronization between Supabase Auth and our assignable users table

-- 1. Create the sync function
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, password_hash, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    'AUTH_MANAGED', -- Placeholder as authentications is handled by Supabase
    'user',
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  )
  ON CONFLICT (username) DO UPDATE SET 
    id = EXCLUDED.id,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

-- 3. Manually sync existing users that might have been missed
-- Specifically the user requested: benedictcftsang@outlook.com
INSERT INTO public.users (id, username, password_hash, role, display_name)
SELECT 
  id, 
  email,
  'AUTH_MANAGED',
  'user',
  'Test User'
FROM auth.users
WHERE email = 'benedictcftsang@outlook.com'
ON CONFLICT (username) DO UPDATE SET id = EXCLUDED.id;
