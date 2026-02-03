-- Create a test user named 'test' for development and testing
-- This user will have the 'user' role and default permissions enabled
DO $$
BEGIN
  -- We use the safe creation function to ensure hashing and role consistency
  -- Parameters: username, password, role, display_name, proofreading, spelling, learning_hub
  PERFORM create_user_with_password(
    'test',
    'password123',
    'user',
    'Test User',
    true,
    true,
    true
  );
EXCEPTION WHEN OTHERS THEN
  -- If the user already exists, just ignore
  RAISE NOTICE 'Test user creation skipped: %', SQLERRM;
END $$;
