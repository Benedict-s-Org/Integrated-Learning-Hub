CREATE OR REPLACE FUNCTION check_sr_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_res jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'policyname', policyname,
    'cmd', cmd,
    'roles', roles,
    'qual', qual,
    'with_check', with_check
  )) INTO v_res
  FROM pg_policies
  WHERE tablename = 'spaced_repetition_attempts';
  
  RETURN v_res;
END;
$$;
