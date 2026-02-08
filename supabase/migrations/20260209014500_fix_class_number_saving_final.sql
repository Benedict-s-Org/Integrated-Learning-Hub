-- Consolidated migration for fixing Class Number saving issue and RLS permissions

-- 1. Enable RLS and add policies for Admin access
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Users Table Policies
DROP POLICY IF EXISTS "Admins can view users" ON public.users;
CREATE POLICY "Admins can view users" ON public.users FOR SELECT TO authenticated USING ((auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' OR (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

DROP POLICY IF EXISTS "Admins can update users" ON public.users;
CREATE POLICY "Admins can update users" ON public.users FOR UPDATE TO authenticated USING ((auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' OR (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin') WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' OR (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

-- 3. User Profiles Table Policies
DROP POLICY IF EXISTS "Admins can manage user_profiles" ON public.user_profiles;
CREATE POLICY "Admins can manage user_profiles" ON public.user_profiles FOR ALL TO authenticated USING ((auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' OR (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin') WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' OR (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

-- 4. Grant access to service_role
GRANT ALL ON TABLE public.users TO service_role;
GRANT ALL ON TABLE public.user_profiles TO service_role;

-- 5. Update update_user_info RPC to bypass checks for system roles and remove non-existent columns
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
  -- System Role Bypass (Edge Functions)
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
     NULL; 
  ELSE
     -- Admin Check for direct RPC calls
     SELECT role INTO current_role FROM users WHERE id = caller_user_id;
     IF current_role != 'admin' OR current_role IS NULL THEN
       RAISE EXCEPTION 'Only admins can update user information. Caller ID: %, Role: %', caller_user_id, COALESCE(current_role, 'NULL');
     END IF;
  END IF;

  -- Super admin protection
  SELECT id INTO first_admin_id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;
  IF target_user_id = first_admin_id AND new_role IS NOT NULL AND new_role != 'admin' THEN
    RAISE EXCEPTION 'Cannot change super admin role';
  END IF;

  -- DB Updates
  UPDATE users SET
    username = COALESCE(new_username, username),
    display_name = COALESCE(new_display_name, display_name),
    role = COALESCE(new_role, role),
    class = CASE WHEN new_class IS NOT NULL THEN new_class ELSE class END
  WHERE id = target_user_id;

  IF new_seat_number IS NOT NULL THEN
    UPDATE user_profiles SET seat_number = new_seat_number WHERE id = target_user_id;
    IF NOT FOUND THEN
      INSERT INTO user_profiles (id, seat_number, display_name, created_at)
      SELECT id, new_seat_number, display_name, created_at FROM users WHERE id = target_user_id;
    END IF;
  END IF;

  SELECT seat_number INTO current_seat_number FROM user_profiles WHERE id = target_user_id;

  SELECT json_build_object(
    'id', id, 'username', username, 'role', role, 'display_name', display_name, 'class', class, 'seat_number', current_seat_number, 'created_at', created_at
  ) INTO updated_user FROM users WHERE id = target_user_id;

  RETURN updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp, extensions;
