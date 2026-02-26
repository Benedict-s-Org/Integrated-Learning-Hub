-- Rename seat_number to class_number in public.users (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'seat_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'class_number'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN seat_number TO class_number;
  END IF;
END $$;

-- Update update_user_info RPC
-- Must drop first because parameter names changed (new_seat_number -> new_class_number)
DROP FUNCTION IF EXISTS public.update_user_info(uuid, uuid, text, text, text, text, integer, integer, uuid);

CREATE OR REPLACE FUNCTION public.update_user_info(
  caller_user_id uuid,
  target_user_id uuid,
  new_username text DEFAULT NULL,
  new_display_name text DEFAULT NULL,
  new_role text DEFAULT NULL,
  new_class text DEFAULT NULL,
  new_class_number integer DEFAULT NULL,
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
BEGIN
  -- Authorization check
  SELECT role INTO current_role FROM users WHERE id = caller_user_id;
  IF current_role != 'admin' AND caller_user_id != target_user_id THEN
    RAISE EXCEPTION 'Unauthorized: only admins or the user themselves can update info';
  END IF;

  -- Update public.users
  UPDATE users SET
    username = COALESCE(new_username, username),
    display_name = COALESCE(new_display_name, display_name),
    role = COALESCE(new_role, role),
    class = CASE WHEN new_class IS NOT NULL THEN new_class ELSE class END,
    class_number = COALESCE(new_class_number, class_number),
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
    'class_number', class_number,
    'spelling_level', spelling_level,
    'managed_by_id', managed_by_id,
    'created_at', created_at
  ) INTO updated_user 
  FROM users 
  WHERE id = target_user_id;

  RETURN updated_user;
END;
$function$;
