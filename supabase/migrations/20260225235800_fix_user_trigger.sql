-- Update the handle_new_auth_user trigger function to capture class and managed_by_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  INSERT INTO public.users (
    id, 
    username, 
    password_hash, 
    role, 
    display_name,
    class,
    managed_by_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    'AUTH_MANAGED', -- Placeholder as authentication is handled by Supabase Auth
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'class',
    (NEW.raw_user_meta_data->>'managed_by_id')::uuid
  )
  ON CONFLICT (username) DO UPDATE SET
    id = EXCLUDED.id,
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    class = COALESCE(EXCLUDED.class, users.class),
    managed_by_id = COALESCE(EXCLUDED.managed_by_id, users.managed_by_id),
    updated_at = now();
  RETURN NEW;
END;
$function$;
