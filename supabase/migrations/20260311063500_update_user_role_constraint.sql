-- Update users table role constraint to include 'class_staff'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'class_staff', 'user'));

-- Update handle_new_auth_user to handle class_staff role from metadata if present
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, display_name, role, managed_by_id, class)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'username'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    (NEW.raw_user_meta_data->>'managed_by_id')::uuid,
    NEW.raw_user_meta_data->>'class'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    managed_by_id = EXCLUDED.managed_by_id,
    class = EXCLUDED.class;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
