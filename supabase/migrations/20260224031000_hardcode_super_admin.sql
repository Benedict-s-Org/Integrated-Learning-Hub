-- Migration: Hardcode Super Admin
-- Description: Updates is_first_admin to explicitly recognize benedictcftsang@gmail.com as the super admin.

CREATE OR REPLACE FUNCTION is_first_admin(check_user_id uuid)
RETURNS boolean AS $$
DECLARE
  super_admin_id uuid;
BEGIN
  -- 1. Try to find the admin by the specific preferred email
  SELECT id INTO super_admin_id
  FROM users
  WHERE username = 'benedictcftsang@gmail.com'
  AND role = 'admin'
  LIMIT 1;
  
  -- 2. Fallback to the oldest admin if not found (original legacy behavior)
  IF super_admin_id IS NULL THEN
    SELECT id INTO super_admin_id
    FROM users
    WHERE role = 'admin'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  
  RETURN check_user_id = super_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp, extensions;

-- Also update all existing users to be managed by this super admin if they have no manager
DO $$
DECLARE
  super_id UUID;
BEGIN
  SELECT id INTO super_id FROM public.users WHERE username = 'benedictcftsang@gmail.com';
  
  IF super_id IS NOT NULL THEN
    UPDATE public.users 
    SET managed_by_id = super_id 
    WHERE role = 'user' AND managed_by_id IS NULL;
    
    -- Ensure the super admin is marked as an admin
    UPDATE public.users SET role = 'admin' WHERE id = super_id;
  END IF;
END $$;
