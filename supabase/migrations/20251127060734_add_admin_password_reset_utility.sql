/*
  # Add Admin Password Reset Utility

  This migration adds a utility function to reset the admin password
  in case of emergency. This is useful for recovery situations.
  
  The function requires the system verification code (949182) to execute,
  ensuring only authorized users can reset the admin password.
*/

-- Function to reset admin password with verification code
CREATE OR REPLACE FUNCTION reset_admin_password(
  verification_code text,
  new_password text DEFAULT '64165644'
)
RETURNS json AS $$
DECLARE
  admin_user_id uuid;
  code_valid boolean;
BEGIN
  -- Verify the system code
  SELECT verify_system_code(verification_code) INTO code_valid;
  
  IF NOT code_valid THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid verification code'
    );
  END IF;
  
  -- Get admin user ID
  SELECT id INTO admin_user_id
  FROM users
  WHERE username = 'admin' AND role = 'admin'
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin user not found'
    );
  END IF;
  
  -- Reset the password
  UPDATE users
  SET 
    password_hash = extensions.crypt(new_password, extensions.gen_salt('bf')),
    force_password_change = false,
    updated_at = now()
  WHERE id = admin_user_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Admin password has been reset',
    'username', 'admin',
    'new_password', new_password
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp;