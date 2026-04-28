-- Drop the parameterless version of get_all_students_performance to resolve function overload ambiguous error (PGRST203)
DROP FUNCTION IF EXISTS public.get_all_students_performance();
