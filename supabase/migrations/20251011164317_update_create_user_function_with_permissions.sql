/*
  # Update create_user_with_password function to set permissions

  1. Changes
    - Update the create_user_with_password function to automatically set permissions
    - Admin users get all permissions set to true
    - Regular users get default permissions (false)
  
  2. Notes
    - Ensures consistency when creating new users
    - Admins don't need manual permission grants
*/

CREATE OR REPLACE FUNCTION create_user_with_password(
  username_input text,
  password_input text,
  role_input text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  new_user json;
BEGIN
  INSERT INTO users (username, password_hash, role, can_access_proofreading, can_access_spelling)
  VALUES (
    username_input,
    crypt(password_input, gen_salt('bf')),
    role_input,
    CASE WHEN role_input = 'admin' THEN true ELSE false END,
    CASE WHEN role_input = 'admin' THEN true ELSE false END
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
$$;