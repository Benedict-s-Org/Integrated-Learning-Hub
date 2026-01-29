/*
  # Fix Users Table RLS Infinite Recursion

  1. Problem
    - Users table SELECT policy queries the users table to check if requester is admin
    - This creates infinite recursion when any other policy tries to check admin status
    - Prevents many operations including spelling_practices INSERT

  2. Solution
    - Add a simple policy that allows users to read their own record (no recursion)
    - Add a SECURITY DEFINER function to check if user is admin (bypasses RLS)
    - Update admin policies to use the secure function instead of querying users table
    - This breaks the recursion cycle while maintaining security

  3. Security Notes
    - Users can only read their own record by default
    - Admin check function is SECURITY DEFINER but only returns boolean
    - All admin operations still require authentication
    - Maintains same security guarantees without recursion
*/

-- Drop existing problematic policies on users table
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;

-- Create a secure function to check if current user is admin
-- SECURITY DEFINER means it runs with the permissions of the function owner (bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simple policy: users can always read their own record
CREATE POLICY "Users can read own record"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admins can read all users (using secure function)
CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins can insert users
CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admins can update users
CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Admins can delete users
CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (is_admin());
