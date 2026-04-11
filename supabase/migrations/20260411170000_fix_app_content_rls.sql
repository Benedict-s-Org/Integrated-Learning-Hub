-- Fix RLS policy for app_content and update is_admin helper
-- This ensures admin@anagram.com is recognized by the database as an administrator.

BEGIN;

-- 1. Update the is_admin function to recognize admin@anagram.com
-- This aligns the database with the frontend App.tsx logic
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check 1: ID Match (Best performance)
  IF EXISTS (SELECT 1 FROM public.users WHERE id = user_id AND role = 'admin') THEN
    RETURN true;
  END IF;
  
  -- Check 2: Email Match from JWT (Covers benedict and admin@anagram.com)
  -- This handles situations where IDs are mismatched but the login email is a known admin
  IF user_id = auth.uid() AND (
    (auth.jwt() ->> 'email') = 'benedictcftsang@gmail.com' OR
    (auth.jwt() ->> 'email') = 'admin@anagram.com' OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE username = (auth.jwt() ->> 'email') 
      AND role = 'admin'
    )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the existing policy
DROP POLICY IF EXISTS "Allow admins to manage app_content" ON public.app_content;

-- 3. Create the fixed policy for ALL operations
CREATE POLICY "Allow admins to manage app_content" 
ON public.app_content FOR ALL 
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

COMMIT;

