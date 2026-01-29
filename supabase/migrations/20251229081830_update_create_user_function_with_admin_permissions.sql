/*
  # Update create_user_with_password Function for Admin Full Access

  1. Function Updates
    - Add optional parameters for all permission flags:
      - can_access_proofreading_input
      - can_access_spelling_input
      - can_access_learning_hub_input
    - When role is 'admin', automatically grant ALL permissions (true)
    - When role is 'user', use provided permission values or default to false
    - Return all permission flags in the JSON response

  2. Behavior
    - Admin users: Automatically get full access to all features regardless of input parameters
    - Regular users: Use provided permissions or default to false
    - Backwards compatible: All new parameters are optional

  3. Security
    - Only admins can call this function (enforced by RLS policies)
    - Admin role guarantees full access to all features
*/

CREATE OR REPLACE FUNCTION create_user_with_password(
  username_input text,
  password_input text,
  role_input text,
  display_name_input text DEFAULT NULL,
  can_access_proofreading_input boolean DEFAULT false,
  can_access_spelling_input boolean DEFAULT false,
  can_access_learning_hub_input boolean DEFAULT false
)
RETURNS json AS $$
DECLARE
  new_user_id uuid;
  new_user json;
  final_display_name text;
  final_proofreading_access boolean;
  final_spelling_access boolean;
  final_learning_hub_access boolean;
BEGIN
  -- Use username as display_name if not provided or empty
  final_display_name := COALESCE(NULLIF(display_name_input, ''), username_input);

  -- If creating an admin, grant ALL permissions automatically
  IF role_input = 'admin' THEN
    final_proofreading_access := true;
    final_spelling_access := true;
    final_learning_hub_access := true;
  ELSE
    -- For regular users, use provided values or defaults
    final_proofreading_access := can_access_proofreading_input;
    final_spelling_access := can_access_spelling_input;
    final_learning_hub_access := can_access_learning_hub_input;
  END IF;

  INSERT INTO users (
    username,
    password_hash,
    role,
    display_name,
    can_access_proofreading,
    can_access_spelling,
    can_access_learning_hub
  )
  VALUES (
    username_input,
    crypt(password_input, gen_salt('bf')),
    role_input,
    final_display_name,
    final_proofreading_access,
    final_spelling_access,
    final_learning_hub_access
  )
  RETURNING id INTO new_user_id;

  SELECT json_build_object(
    'id', id,
    'username', username,
    'role', role,
    'display_name', display_name,
    'can_access_proofreading', can_access_proofreading,
    'can_access_spelling', can_access_spelling,
    'can_access_learning_hub', can_access_learning_hub,
    'created_at', created_at
  ) INTO new_user
  FROM users
  WHERE id = new_user_id;

  RETURN new_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp, extensions;