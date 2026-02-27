-- Migration: Add a SECURITY DEFINER function to expose auth.users emails to admins
-- This function reads from auth.users (which is otherwise inaccessible from public schema)
-- and returns a table of (id, email) pairs, callable via supabase.rpc()

CREATE OR REPLACE FUNCTION get_auth_emails()
RETURNS TABLE(user_id uuid, auth_email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id AS user_id, email AS auth_email
  FROM auth.users
  WHERE email IS NOT NULL;
$$;

-- Grant execute to authenticated users (frontend can call it)
GRANT EXECUTE ON FUNCTION get_auth_emails() TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_emails() TO anon;
