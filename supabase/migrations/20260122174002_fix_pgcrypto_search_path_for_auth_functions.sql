/*
  # Fix pgcrypto Search Path for Authentication Functions

  1. Problem
    - The verify_password function couldn't access crypt() from pgcrypto
    - pgcrypto is installed in 'extensions' schema
    - Function search_path didn't include 'extensions'
    
  2. Solution
    - Update search_path for all auth functions to include 'extensions'
    - This allows pgcrypto functions to be found during execution
*/

ALTER FUNCTION public.verify_password(uuid, text) 
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.create_user_with_password(text, text, text) 
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.create_user_with_password(text, text, text, text, boolean, boolean, boolean, text) 
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.change_user_password(uuid, text) 
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.verify_system_code(text) 
  SET search_path = public, extensions, pg_temp;
