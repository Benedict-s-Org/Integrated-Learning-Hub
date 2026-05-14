CREATE OR REPLACE FUNCTION check_admin_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_res jsonb;
BEGIN
  SELECT jsonb_build_object(
    'count', COUNT(*),
    'users', jsonb_agg(jsonb_build_object('id', id, 'role', role, 'username', username))
  ) INTO v_res
  FROM public.users
  WHERE username = 'admin' OR username = 'admin@anagram.com';
  
  RETURN v_res;
END;
$$;
