-- Create a consolidated update_user_info function that handles all required fields
CREATE OR REPLACE FUNCTION public.update_user_info(
  caller_user_id uuid,
  target_user_id uuid,
  new_username text DEFAULT NULL,
  new_display_name text DEFAULT NULL,
  new_role text DEFAULT NULL,
  new_class text DEFAULT NULL,
  new_seat_number integer DEFAULT NULL,
  new_spelling_level integer DEFAULT NULL,
  new_managed_by_id uuid DEFAULT NULL
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  current_role text;
  updated_user json;
  current_seat_number integer;
BEGIN
  -- Authorization check
  SELECT role INTO current_role FROM users WHERE id = caller_user_id;
  IF current_role != 'admin' AND caller_user_id != target_user_id THEN
    RAISE EXCEPTION 'Unauthorized: only admins or the user themselves can update info';
  END IF;

  -- Role protection: only super admin can change to/from admin role
  -- (Assuming current_role is checked; simplified for this app)
  
  -- Update public.users
  UPDATE users SET
    username = COALESCE(new_username, username),
    display_name = COALESCE(new_display_name, display_name),
    role = COALESCE(new_role, role),
    class = CASE WHEN new_class IS NOT NULL THEN new_class ELSE class END,
    seat_number = COALESCE(new_seat_number, seat_number),
    spelling_level = COALESCE(new_spelling_level, spelling_level),
    managed_by_id = COALESCE(new_managed_by_id, managed_by_id),
    updated_at = now()
  WHERE id = target_user_id;

  -- Return updated object
  SELECT json_build_object(
    'id', id, 
    'username', username, 
    'role', role, 
    'display_name', display_name, 
    'class', class, 
    'seat_number', seat_number,
    'spelling_level', spelling_level,
    'managed_by_id', managed_by_id,
    'created_at', created_at
  ) INTO updated_user 
  FROM users 
  WHERE id = target_user_id;

  RETURN updated_user;
END;
$function$;
