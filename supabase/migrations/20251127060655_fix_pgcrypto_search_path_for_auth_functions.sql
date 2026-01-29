/*
  # Fix pgcrypto Search Path for Authentication Functions

  This migration fixes the login issue by updating the search_path for all
  authentication functions that use pgcrypto's crypt() function.
  
  The issue: pgcrypto is installed in the 'extensions' schema, but functions
  had search_path set to 'public, pg_temp' which doesn't include 'extensions'.
  
  This caused all password verification to fail because crypt() couldn't be found.
  
  Solution: Add 'extensions' to the search_path for all functions that use crypt().
*/

-- Fix verify_password function
ALTER FUNCTION public.verify_password(uuid, text) 
  SET search_path = public, extensions, pg_temp;

-- Fix create_user_with_password functions (both overloads)
ALTER FUNCTION public.create_user_with_password(text, text, text) 
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.create_user_with_password(text, text, text, text) 
  SET search_path = public, extensions, pg_temp;

-- Fix change_user_password function
ALTER FUNCTION public.change_user_password(uuid, text) 
  SET search_path = public, extensions, pg_temp;

-- Fix verify_system_code function (also uses crypt)
ALTER FUNCTION public.verify_system_code(text) 
  SET search_path = public, extensions, pg_temp;