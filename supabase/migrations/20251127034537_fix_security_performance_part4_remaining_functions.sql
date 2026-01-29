/*
  # Fix Security and Performance Issues - Part 4
  
  Fix remaining functions with proper search_path
*/

-- Handle overloaded create_user_with_password functions
ALTER FUNCTION public.create_user_with_password(text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_user_with_password(text, text, text, text) SET search_path = public, pg_temp;

-- Set search_path for analytics and other functions
ALTER FUNCTION public.get_class_analytics_summary(timestamptz, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_all_students_performance() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_student_detailed_analytics(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_practice_activity_timeline(integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_performance_distribution(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_recent_activity(integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_assigned_proofreading_practices(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_proofreading_assignment_stats(uuid) SET search_path = public, pg_temp;