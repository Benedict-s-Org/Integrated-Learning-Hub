-- Fix Proofreading Assignment Stats RPC Permissions
-- Created: 2026-02-03 21:20:00

-- Ensure the function exists and has correct security settings
ALTER FUNCTION public.get_proofreading_assignment_stats(uuid) 
  SET search_path = public, pg_temp;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_proofreading_assignment_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_proofreading_assignment_stats(uuid) TO service_role;

-- Also fix get_user_assigned_proofreading_practices just in case
ALTER FUNCTION public.get_user_assigned_proofreading_practices(uuid)
  SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_user_assigned_proofreading_practices(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_assigned_proofreading_practices(uuid) TO service_role;
