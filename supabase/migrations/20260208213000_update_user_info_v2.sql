-- Update update_user_info function to include seat_number
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
  current_seat_number integer;
BEGIN
  -- Check if caller is the first admin (super admin)
  -- Note: We rely on is_first_admin function existing from previous migrations
  IF NOT is_first_admin(caller_user_id) THEN
    RAISE EXCEPTION 'Only the super admin can update user information';
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
  -- Only update if a new seat number is provided
  IF new_seat_number IS NOT NULL THEN
    -- Try to update existing profile
    UPDATE user_profiles
    SET seat_number = new_seat_number
    WHERE id = target_user_id;
    
    -- If no profile exists (unlikely given triggers, but possible), insert one
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
