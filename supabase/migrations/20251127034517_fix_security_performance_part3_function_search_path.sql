/*
  # Fix Security and Performance Issues - Part 3
  
  Fix function security by setting proper search_path
  This prevents search path injection attacks
*/

-- Set search_path for all public functions
ALTER FUNCTION public.update_content_reference_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_password(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.change_user_password(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.verify_system_code(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_saved_contents_count(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_progress_summary(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_spelling_rankings() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_recommended_voice(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_proofreading_rankings() SET search_path = public, pg_temp;