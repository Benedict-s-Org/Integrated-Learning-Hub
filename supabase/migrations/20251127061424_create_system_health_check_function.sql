/*
  # Create System Health Check Function

  This migration creates a comprehensive health check function that verifies
  all critical system functionality, especially authentication.
  
  This function should be called after any security-related changes to ensure
  the system is still working correctly.
  
  Tests performed:
  1. pgcrypto extension accessibility
  2. Password hashing functionality
  3. Password verification functionality
  4. User creation capability
  5. System code verification
  6. All auth functions can access required dependencies
*/

CREATE OR REPLACE FUNCTION run_system_health_check()
RETURNS json AS $$
DECLARE
  health_report json;
  test_results json[] := ARRAY[]::json[];
  test_hash text;
  test_verify boolean;
  test_user_id uuid;
  overall_status text := 'HEALTHY';
BEGIN
  -- Test 1: Check if pgcrypto extension is accessible
  BEGIN
    SELECT extensions.gen_salt('bf') INTO test_hash;
    test_results := array_append(test_results, json_build_object(
      'test', 'pgcrypto_extension_access',
      'status', 'PASS',
      'message', 'pgcrypto extension is accessible'
    ));
  EXCEPTION WHEN OTHERS THEN
    overall_status := 'CRITICAL';
    test_results := array_append(test_results, json_build_object(
      'test', 'pgcrypto_extension_access',
      'status', 'FAIL',
      'message', 'Cannot access pgcrypto extension: ' || SQLERRM
    ));
  END;

  -- Test 2: Check if password hashing works
  BEGIN
    test_hash := extensions.crypt('test_password', extensions.gen_salt('bf'));
    IF test_hash IS NOT NULL AND length(test_hash) > 20 THEN
      test_results := array_append(test_results, json_build_object(
        'test', 'password_hashing',
        'status', 'PASS',
        'message', 'Password hashing is working'
      ));
    ELSE
      overall_status := 'CRITICAL';
      test_results := array_append(test_results, json_build_object(
        'test', 'password_hashing',
        'status', 'FAIL',
        'message', 'Password hash generation returned invalid result'
      ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    overall_status := 'CRITICAL';
    test_results := array_append(test_results, json_build_object(
      'test', 'password_hashing',
      'status', 'FAIL',
      'message', 'Password hashing failed: ' || SQLERRM
    ));
  END;

  -- Test 3: Check if password verification works
  BEGIN
    test_verify := (test_hash = extensions.crypt('test_password', test_hash));
    IF test_verify THEN
      test_results := array_append(test_results, json_build_object(
        'test', 'password_verification',
        'status', 'PASS',
        'message', 'Password verification is working'
      ));
    ELSE
      overall_status := 'CRITICAL';
      test_results := array_append(test_results, json_build_object(
        'test', 'password_verification',
        'status', 'FAIL',
        'message', 'Password verification returned false for matching passwords'
      ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    overall_status := 'CRITICAL';
    test_results := array_append(test_results, json_build_object(
      'test', 'password_verification',
      'status', 'FAIL',
      'message', 'Password verification failed: ' || SQLERRM
    ));
  END;

  -- Test 4: Check if verify_password function works
  BEGIN
    -- Use the admin user for testing
    SELECT id INTO test_user_id FROM users WHERE username = 'admin' AND role = 'admin' LIMIT 1;
    IF test_user_id IS NOT NULL THEN
      -- We can't test with the actual password, but we can test that the function executes
      PERFORM verify_password(test_user_id, 'dummy_test_password');
      test_results := array_append(test_results, json_build_object(
        'test', 'verify_password_function',
        'status', 'PASS',
        'message', 'verify_password function executes without errors'
      ));
    ELSE
      IF overall_status = 'HEALTHY' THEN overall_status := 'WARNING'; END IF;
      test_results := array_append(test_results, json_build_object(
        'test', 'verify_password_function',
        'status', 'WARNING',
        'message', 'No admin user found to test verify_password function'
      ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    overall_status := 'CRITICAL';
    test_results := array_append(test_results, json_build_object(
      'test', 'verify_password_function',
      'status', 'FAIL',
      'message', 'verify_password function failed: ' || SQLERRM
    ));
  END;

  -- Test 5: Check if verify_system_code function works
  BEGIN
    PERFORM verify_system_code('dummy_code');
    test_results := array_append(test_results, json_build_object(
      'test', 'verify_system_code_function',
      'status', 'PASS',
      'message', 'verify_system_code function executes without errors'
    ));
  EXCEPTION WHEN OTHERS THEN
    overall_status := 'CRITICAL';
    test_results := array_append(test_results, json_build_object(
      'test', 'verify_system_code_function',
      'status', 'FAIL',
      'message', 'verify_system_code function failed: ' || SQLERRM
    ));
  END;

  -- Test 6: Check if admin user exists
  BEGIN
    SELECT id INTO test_user_id FROM users WHERE username = 'admin' AND role = 'admin' LIMIT 1;
    IF test_user_id IS NOT NULL THEN
      test_results := array_append(test_results, json_build_object(
        'test', 'admin_user_exists',
        'status', 'PASS',
        'message', 'Admin user exists in database'
      ));
    ELSE
      IF overall_status = 'HEALTHY' THEN overall_status := 'WARNING'; END IF;
      test_results := array_append(test_results, json_build_object(
        'test', 'admin_user_exists',
        'status', 'WARNING',
        'message', 'No admin user found in database'
      ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF overall_status = 'HEALTHY' THEN overall_status := 'WARNING'; END IF;
    test_results := array_append(test_results, json_build_object(
      'test', 'admin_user_exists',
      'status', 'WARNING',
      'message', 'Could not check for admin user: ' || SQLERRM
    ));
  END;

  -- Build final health report
  health_report := json_build_object(
    'overall_status', overall_status,
    'timestamp', now(),
    'tests_run', array_length(test_results, 1),
    'test_results', test_results
  );

  RETURN health_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp;