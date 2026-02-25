-- Migration: Repair Admin Role
-- Description: Ensures the primary admin user has the admin role in the public.users table.

UPDATE public.users 
SET role = 'admin' 
WHERE username = 'benedictcftsang@gmail.com';

-- Also ensure super admin status logic is healthy by re-linking managed_by_id if needed
DO $$
DECLARE
  super_id UUID;
BEGIN
  SELECT id INTO super_id FROM public.users WHERE username = 'benedictcftsang@gmail.com';
  
  IF super_id IS NOT NULL THEN
    -- Ensure students are managed by the real admin ID
    UPDATE public.users 
    SET managed_by_id = super_id 
    WHERE role = 'user' AND (managed_by_id IS NULL OR managed_by_id NOT IN (SELECT id FROM users WHERE role = 'admin'));
  END IF;
END $$;
