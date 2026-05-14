CREATE OR REPLACE FUNCTION check_sched_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_res jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'policyname', policyname,
    'cmd', cmd
  )) INTO v_res
  FROM pg_policies
  WHERE tablename = 'spaced_repetition_schedules';
  
  RETURN v_res;
END;
$$;
