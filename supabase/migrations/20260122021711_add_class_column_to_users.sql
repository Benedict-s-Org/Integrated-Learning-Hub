/*
  # Add Class Column to Users Table

  1. Changes
    - Add `class` column to users table to support class-based organization
    - Add index on class column for efficient filtering and sorting
    - Update create_user_with_password function to support class parameter
    - Update update_user_info function to support class updates

  2. Notes
    - Class is optional (can be NULL)
    - Classes are stored as text to allow flexible naming (e.g., "A", "B", "Grade 9", "Advanced", etc.)
    - Default value is NULL (no class assigned)
*/

-- Add class column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'class'
  ) THEN
    ALTER TABLE users ADD COLUMN class text DEFAULT NULL;
  END IF;
END $$;

-- Add index for efficient class-based queries
CREATE INDEX IF NOT EXISTS idx_users_class ON users(class) WHERE class IS NOT NULL;

-- Update the create_user_with_password function to include class
CREATE OR REPLACE FUNCTION create_user_with_password(
  username_input text,
  password_input text,
  role_input text DEFAULT 'user',
  display_name_input text DEFAULT NULL,
  can_access_proofreading_input boolean DEFAULT false,
  can_access_spelling_input boolean DEFAULT false,
  can_access_learning_hub_input boolean DEFAULT false,
  class_input text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  new_user_id uuid;
  new_user json;
BEGIN
  IF role_input = 'admin' THEN
    INSERT INTO users (username, password_hash, role, display_name, can_access_proofreading, can_access_spelling, can_access_learning_hub, class)
    VALUES (
      username_input,
      crypt(password_input, gen_salt('bf')),
      role_input,
      COALESCE(display_name_input, username_input),
      true,
      true,
      true,
      class_input
    )
    RETURNING id INTO new_user_id;
  ELSE
    INSERT INTO users (username, password_hash, role, display_name, can_access_proofreading, can_access_spelling, can_access_learning_hub, class)
    VALUES (
      username_input,
      crypt(password_input, gen_salt('bf')),
      role_input,
      COALESCE(display_name_input, username_input),
      can_access_proofreading_input,
      can_access_spelling_input,
      can_access_learning_hub_input,
      class_input
    )
    RETURNING id INTO new_user_id;
  END IF;

  SELECT json_build_object(
    'id', id,
    'username', username,
    'role', role,
    'display_name', display_name,
    'can_access_proofreading', can_access_proofreading,
    'can_access_spelling', can_access_spelling,
    'can_access_learning_hub', can_access_learning_hub,
    'class', class,
    'created_at', created_at
  ) INTO new_user
  FROM users
  WHERE id = new_user_id;

  RETURN new_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp, extensions;

-- Update the update_user_info function to include class
CREATE OR REPLACE FUNCTION update_user_info(
  caller_user_id uuid,
  target_user_id uuid,
  new_username text DEFAULT NULL,
  new_display_name text DEFAULT NULL,
  new_role text DEFAULT NULL,
  new_class text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  updated_user json;
  first_admin_id uuid;
BEGIN
  -- Check if caller is the first admin
  IF NOT is_first_admin(caller_user_id) THEN
    RAISE EXCEPTION 'Only the super admin can update user information';
  END IF;

  -- Get the first admin ID
  SELECT id INTO first_admin_id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Prevent changing the super admin's role
  IF target_user_id = first_admin_id AND new_role IS NOT NULL AND new_role != 'admin' THEN
    RAISE EXCEPTION 'Cannot change super admin role';
  END IF;

  -- Update the user
  UPDATE users
  SET
    username = COALESCE(new_username, username),
    display_name = COALESCE(new_display_name, display_name),
    role = COALESCE(new_role, role),
    class = CASE 
      WHEN new_class IS NOT NULL THEN new_class
      ELSE class
    END
  WHERE id = target_user_id;

  -- Return updated user info
  SELECT json_build_object(
    'id', id,
    'username', username,
    'role', role,
    'display_name', display_name,
    'can_access_proofreading', can_access_proofreading,
    'can_access_spelling', can_access_spelling,
    'can_access_learning_hub', can_access_learning_hub,
    'class', class,
    'created_at', created_at
  ) INTO updated_user
  FROM users
  WHERE id = target_user_id;

  RETURN updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp, extensions;
