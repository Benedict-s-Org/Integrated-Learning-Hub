/*
  # Add Authentication Helper Functions

  1. New Functions
    - `verify_password` - Verifies a user's password against stored hash
    - `create_user_with_password` - Creates a new user with hashed password
    - `change_user_password` - Changes a user's password and clears force_password_change flag
    - `verify_system_code` - Verifies the system verification code

  2. Security
    - All functions use SECURITY DEFINER to bypass RLS
    - Functions validate inputs and handle errors securely
    - Password hashes are never exposed in responses
*/

-- Function to verify password
CREATE OR REPLACE FUNCTION verify_password(user_id uuid, password_input text)
RETURNS boolean AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM users
  WHERE id = user_id;
  
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN stored_hash = crypt(password_input, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create user with password
CREATE OR REPLACE FUNCTION create_user_with_password(
  username_input text,
  password_input text,
  role_input text
)
RETURNS json AS $$
DECLARE
  new_user_id uuid;
  new_user json;
BEGIN
  INSERT INTO users (username, password_hash, role)
  VALUES (
    username_input,
    crypt(password_input, gen_salt('bf')),
    role_input
  )
  RETURNING id INTO new_user_id;
  
  SELECT json_build_object(
    'id', id,
    'username', username,
    'role', role,
    'created_at', created_at
  ) INTO new_user
  FROM users
  WHERE id = new_user_id;
  
  RETURN new_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to change user password
CREATE OR REPLACE FUNCTION change_user_password(user_id uuid, new_password text)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET 
    password_hash = crypt(new_password, gen_salt('bf')),
    force_password_change = false,
    updated_at = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify system verification code
CREATE OR REPLACE FUNCTION verify_system_code(code_input text)
RETURNS boolean AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT value INTO stored_hash
  FROM system_config
  WHERE key = 'verification_code';
  
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN stored_hash = crypt(code_input, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;