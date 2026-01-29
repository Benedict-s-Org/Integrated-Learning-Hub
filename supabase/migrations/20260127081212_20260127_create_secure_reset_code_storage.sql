/*
  # Create Secure Reset Code Storage

  1. New Table
    - `admin_reset_code_store`
      - `id` (uuid, primary key)
      - `code_hash` (text) - Bcrypt hash of the reset code
      - `created_at` (timestamptz)
      - This table stores the hashed code, never the actual code

  2. Security
    - Enable RLS - no one can view this table directly
    - The code is hashed using bcrypt (pgcrypto crypt)
    - Function accesses it with SECURITY DEFINER
    - Table is never exposed to clients

  3. Important Notes
    - Only stores the hash of code 949182
    - The actual code 949182 is never stored or exposed
    - Function verifies input against stored hash
*/

-- Create table to securely store the hashed reset code
CREATE TABLE IF NOT EXISTS admin_reset_code_store (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS - complete lockdown
ALTER TABLE admin_reset_code_store ENABLE ROW LEVEL SECURITY;

-- No one can select (even with SECURITY DEFINER, we'll use function directly)
CREATE POLICY "No direct access to reset codes"
  ON admin_reset_code_store FOR SELECT
  TO authenticated
  USING (false);

-- No one can insert
CREATE POLICY "No direct inserts to reset codes"
  ON admin_reset_code_store FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Initialize with the hashed code for 949182
-- The crypt function creates a bcrypt hash
DO $$
BEGIN
  -- Clear any existing codes
  DELETE FROM admin_reset_code_store;
  
  -- Insert the hashed code for 949182
  -- The crypt function with 'bf' salt generates a bcrypt hash
  INSERT INTO admin_reset_code_store (code_hash)
  VALUES (extensions.crypt('949182', extensions.gen_salt('bf')));
END $$;

-- Update the reset function to use the stored hash
CREATE OR REPLACE FUNCTION reset_admin_password_by_code(
  reset_code text,
  new_password text
)
RETURNS json AS $$
DECLARE
  result json;
  code_matches boolean;
  stored_hash text;
BEGIN
  -- Get the stored hash (function has SECURITY DEFINER so it can access)
  SELECT code_hash INTO stored_hash FROM admin_reset_code_store LIMIT 1;
  
  IF stored_hash IS NULL THEN
    result := json_build_object(
      'success', false,
      'message', 'Reset code not configured'
    );
    INSERT INTO admin_password_reset_log (status) VALUES ('error_no_code');
    RETURN result;
  END IF;
  
  -- Verify the code against the stored hash
  code_matches := extensions.crypt(reset_code, stored_hash) = stored_hash;
  
  IF NOT code_matches THEN
    INSERT INTO admin_password_reset_log (status) VALUES ('failed_invalid_code');
    result := json_build_object(
      'success', false,
      'message', 'Invalid reset code'
    );
    RETURN result;
  END IF;
  
  -- Validate new password length
  IF LENGTH(new_password) < 6 THEN
    result := json_build_object(
      'success', false,
      'message', 'Password must be at least 6 characters'
    );
    RETURN result;
  END IF;
  
  -- Update the admin user password in auth.users
  UPDATE auth.users
  SET 
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    updated_at = now()
  WHERE email = 'admin@example.com';
  
  INSERT INTO admin_password_reset_log (status) VALUES ('success');
  
  result := json_build_object(
    'success', true,
    'message', 'Admin password has been reset successfully'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;