/*
  # Update create_user_with_password Function to Include display_name

  1. Function Updates
    - Modify `create_user_with_password` to accept display_name parameter
    - If display_name is not provided or empty, default to username
    - Return display_name in the json response

  2. Notes
    - Backwards compatible: display_name parameter is optional
    - Defaults display_name to username when not provided
*/

-- Function to create user with password and display_name
CREATE OR REPLACE FUNCTION create_user_with_password(
  username_input text,
  password_input text,
  role_input text,
  display_name_input text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  new_user_id uuid;
  new_user json;
  final_display_name text;
BEGIN
  -- Use username as display_name if not provided or empty
  final_display_name := COALESCE(NULLIF(display_name_input, ''), username_input);

  INSERT INTO users (username, password_hash, role, display_name)
  VALUES (
    username_input,
    crypt(password_input, gen_salt('bf')),
    role_input,
    final_display_name
  )
  RETURNING id INTO new_user_id;

  SELECT json_build_object(
    'id', id,
    'username', username,
    'role', role,
    'display_name', display_name,
    'created_at', created_at
  ) INTO new_user
  FROM users
  WHERE id = new_user_id;

  RETURN new_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
