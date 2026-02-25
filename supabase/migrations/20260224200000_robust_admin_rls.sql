-- Migration: Robust Admin RLS and ID Alignment
-- Description: Fixes the 403 Forbidden error in the Map Editor by ensuring admins are correctly recognized regardless of ID mismatches.

-- 1. Improved is_admin function with Email-fallback
-- This handles situations where the Supabase Auth ID (auth.uid()) does not match the ID in the public.users table.
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check 1: ID Match (Best performance)
  IF EXISTS (SELECT 1 FROM public.users WHERE id = user_id AND role = 'admin') THEN
    RETURN true;
  END IF;
  
  -- Check 2: Email Match from JWT
  -- Only performs this check if user_id matches the current authenticated user
  IF user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE username = (auth.jwt() ->> 'email') 
    AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Align Super Admin ID if mismatched
-- This fixes the root cause by aligning the public.users record ID with the auth.users ID
DO $$
DECLARE
  auth_id UUID;
  public_username_id UUID;
BEGIN
  -- Get the real ID from Supabase Auth
  SELECT id INTO auth_id FROM auth.users WHERE email = 'benedictcftsang@gmail.com';
  
  -- Get the current ID in the public.users table for that email
  SELECT id INTO public_username_id FROM public.users WHERE username = 'benedictcftsang@gmail.com';
  
  -- If they are different, we try to unify them
  IF auth_id IS NOT NULL AND public_username_id IS NOT NULL AND auth_id != public_username_id THEN
    -- Update references first (if any within public schema that we can control)
    -- Update user_room_data if it already exists for the old ID
    UPDATE public.user_room_data SET user_id = auth_id WHERE user_id = public_username_id;
    
    -- Update the users table record ID
    UPDATE public.users SET id = auth_id WHERE id = public_username_id;
  END IF;
END $$;

-- 3. Re-apply RLS Policies for user_room_data
DROP POLICY IF EXISTS "Admins can manage all room data" ON public.user_room_data;
CREATE POLICY "Admins can manage all room data"
    ON public.user_room_data
    FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- 4. Ensure public.is_admin is available for checking
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
