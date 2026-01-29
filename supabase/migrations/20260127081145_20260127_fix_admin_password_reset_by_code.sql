/*
  # Fix Admin Password Reset by Code Function

  Corrects the previous migration to use proper pgcrypto functions with schema prefixes.
  The reset code 949182 is hashed and verified securely.
*/

-- Drop the previous function if it exists
DROP FUNCTION IF EXISTS reset_admin_password_by_code(text, text);

-- Create function to reset admin password by code
CREATE OR REPLACE FUNCTION reset_admin_password_by_code(
  reset_code text,
  new_password text
)
RETURNS json AS $$
DECLARE
  result json;
  code_matches boolean;
BEGIN
  -- The correct hashed code for 949182 (bcrypt)
  -- This hash is generated once and never changes
  -- Hash format: $2a$06$nOUIs5kJ7naTeiMYlfQo6OPST9/PgBkqquzi.Ss7KIUgO2t0jKDga
  code_matches := extensions.crypt(reset_code, '$2a$06$nOUIs5kJ7naTeiMYlfQo6OPST9/PgBkqquzi.Ss7KIUgO2t0jKDga') = '$2a$06$nOUIs5kJ7naTeiMYlfQo6OPST9/PgBkqquzi.Ss7KIUgO2t0jKDga';
  
  IF NOT code_matches THEN
    -- Log failed attempt
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
  
  -- Log successful reset
  INSERT INTO admin_password_reset_log (status) VALUES ('success');
  
  result := json_build_object(
    'success', true,
    'message', 'Admin password has been reset successfully'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;