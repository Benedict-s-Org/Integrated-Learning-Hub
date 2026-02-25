-- Migration: Super Repair Admin Access
-- Description: Fixes admin role and ensures orphaned students are visible to the primary admin.

-- 1. Ensure the primary admin has the 'admin' role in the public.users table.
-- This is critical because RLS checks the role in the public table.
INSERT INTO public.users (id, username, password_hash, role, display_name)
SELECT 
  id, 
  email, 
  'AUTH_MANAGED', 
  'admin', 
  COALESCE(raw_user_meta_data->>'display_name', email)
FROM auth.users
WHERE email = 'benedictcftsang@gmail.com'
ON CONFLICT (username) DO UPDATE SET role = 'admin';

-- 2. Backfill managed_by_id for students if it's missing or mislinked.
-- In the multi-admin system, students are only visible to the admin who "manages" them.
DO $$
DECLARE
  primary_admin_id UUID;
BEGIN
  SELECT id INTO primary_admin_id FROM public.users WHERE username = 'benedictcftsang@gmail.com';
  
  IF primary_admin_id IS NOT NULL THEN
    -- Only update users who aren't already managed by a valid admin
    UPDATE public.users 
    SET managed_by_id = primary_admin_id 
    WHERE role = 'user' 
    AND (
      managed_by_id IS NULL 
      OR managed_by_id NOT IN (SELECT id FROM public.users WHERE role = 'admin')
    );
  END IF;
END $$;
