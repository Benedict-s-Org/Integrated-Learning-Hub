/*
  # Drop Old create_user_with_password Function Version

  1. Purpose
    - Remove the old 4-parameter version of create_user_with_password function
    - Resolve function overloading ambiguity that causes "Could not choose best candidate" errors
    - Keep only the new 7-parameter version with permission flags

  2. Technical Details
    - The old function signature: create_user_with_password(text, text, text, text)
    - The new function signature: create_user_with_password(text, text, text, text, boolean, boolean, boolean)
    - PostgreSQL treats these as separate functions due to different parameter lists
    - When called with 4 parameters, PostgreSQL cannot determine which to use

  3. Impact
    - After this migration, all calls must use the new function signature
    - The new function has DEFAULT values, so calling with 4 parameters will still work
    - Admin users will automatically get all permissions set to true
    - Regular users will get permissions based on provided values or defaults (false)
*/

-- Drop the old 4-parameter version of the function
DROP FUNCTION IF EXISTS create_user_with_password(text, text, text, text);
