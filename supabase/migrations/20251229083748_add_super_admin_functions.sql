/*
  # Add Super Admin Functions

  1. New Functions
    - `is_first_admin(user_id)` - Checks if the given user is the first admin created
    - `update_user_info(target_user_id, new_username, new_display_name, new_role)` - Updates user information
    - `admin_change_user_password(target_user_id, new_password)` - Allows admin to change any user's password

  2. Security
    - Only the first admin (super admin) can update user information or change passwords
    - The first admin is identified as the admin user with the earliest created_at timestamp
    - Super admin cannot be deleted or have their role changed by other admins

  3. Notes
    - These functions use SECURITY DEFINER to bypass RLS
    - Internal checks ensure only the first admin can execute sensitive operations
*/

-- Function to check if a user is the first admin (super admin)
CREATE OR REPLACE FUNCTION is_first_admin(check_user_id uuid)
RETURNS boolean AS $$
DECLARE
  first_admin_id uuid;
BEGIN
  -- Get the ID of the first admin created
  SELECT id INTO first_admin_id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN check_user_id = first_admin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp, extensions;

-- Function to update user information (only super admin can call this)
CREATE OR REPLACE FUNCTION update_user_info(
  caller_user_id uuid,
  target_user_id uuid,
  new_username text DEFAULT NULL,
  new_display_name text DEFAULT NULL,
  new_role text DEFAULT NULL
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
    role = COALESCE(new_role, role)
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
    'created_at', created_at
  ) INTO updated_user
  FROM users
  WHERE id = target_user_id;

  RETURN updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp, extensions;

-- Function for admin to change any user's password (only super admin)
CREATE OR REPLACE FUNCTION admin_change_user_password(
  caller_user_id uuid,
  target_user_id uuid,
  new_password text
)
RETURNS boolean AS $$
BEGIN
  -- Check if caller is the first admin
  IF NOT is_first_admin(caller_user_id) THEN
    RAISE EXCEPTION 'Only the super admin can change user passwords';
  END IF;

  -- Update the password
  UPDATE users
  SET password_hash = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp, extensions;

-- Function to check if user can be deleted (only super admin can delete, and cannot delete themselves)
CREATE OR REPLACE FUNCTION can_delete_user(
  caller_user_id uuid,
  target_user_id uuid
)
RETURNS boolean AS $$
DECLARE
  first_admin_id uuid;
BEGIN
  -- Check if caller is the first admin
  IF NOT is_first_admin(caller_user_id) THEN
    RETURN false;
  END IF;

  -- Get the first admin ID
  SELECT id INTO first_admin_id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Cannot delete the super admin
  IF target_user_id = first_admin_id THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp, extensions;
