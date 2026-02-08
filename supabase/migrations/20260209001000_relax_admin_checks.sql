-- Relax security checks to allow ANY admin (not just the first one) to manage users
-- This prevents 403 errors when using an admin account that is not the "earliest" one.

CREATE OR REPLACE FUNCTION update_user_info(
  caller_user_id uuid,
  target_user_id uuid,
  new_username text DEFAULT NULL,
  new_display_name text DEFAULT NULL,
  new_role text DEFAULT NULL,
  new_class text DEFAULT NULL,
  new_seat_number integer DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  updated_user json;
  first_admin_id uuid;
  current_role text;
  current_seat_number integer;
BEGIN
  -- Verify caller is an admin
  SELECT role INTO current_role FROM users WHERE id = caller_user_id;
  IF current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user information';
  END IF;

  -- Get the first admin ID to protect super admin
  SELECT id INTO first_admin_id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Prevent changing the super admin's role
  IF target_user_id = first_admin_id AND new_role IS NOT NULL AND new_role != 'admin' THEN
    RAISE EXCEPTION 'Cannot change super admin role';
  END IF;

  -- Update the users table
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

  -- Update user_profiles table for seat_number
  IF new_seat_number IS NOT NULL THEN
    UPDATE user_profiles
    SET seat_number = new_seat_number
    WHERE id = target_user_id;
    
    IF NOT FOUND THEN
      INSERT INTO user_profiles (id, seat_number, display_name, created_at)
      SELECT id, new_seat_number, display_name, created_at
      FROM users WHERE id = target_user_id;
    END IF;
  END IF;

  -- Get current seat number for response
  SELECT seat_number INTO current_seat_number FROM user_profiles WHERE id = target_user_id;

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
    'seat_number', current_seat_number,
    'created_at', created_at
  ) INTO updated_user
  FROM users
  WHERE id = target_user_id;

  RETURN updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp, extensions;

-- Also relax admin_change_user_password
CREATE OR REPLACE FUNCTION admin_change_user_password(
  caller_user_id uuid,
  target_user_id uuid,
  new_password text
)
RETURNS boolean AS $$
DECLARE
  current_role text;
BEGIN
  -- Verify caller is an admin
  SELECT role INTO current_role FROM users WHERE id = caller_user_id;
  IF current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change user passwords';
  END IF;

  -- Update the password (using crypt if available, or just set it if using a different system)
  -- Since we have pgcrypto from previous migrations:
  UPDATE users
  SET password_hash = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp, extensions;
