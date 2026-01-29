# Database Functions Reference

This document provides comprehensive information about database functions, their dependencies, and security configurations.

## Critical Information

**⚠️ IMPORTANT: Authentication Depends on Correct search_path Configuration**

The authentication system uses PostgreSQL's `pgcrypto` extension for password hashing. This extension is installed in the `extensions` schema, NOT the `public` schema. Any function that uses `crypt()` or `gen_salt()` MUST include `extensions` in its search_path.

### Why This Matters

When applying security fixes that modify function `search_path` settings, you MUST ensure functions that depend on external extensions (like pgcrypto) can still access those extensions. Failure to do so will break authentication and users will not be able to log in.

## Function Categories and search_path Requirements

### 1. Authentication Functions (CRITICAL)

These functions MUST have `search_path = public, extensions, pg_temp`:

- **`verify_password(user_id uuid, password_input text)`**
  - Purpose: Verifies a user's password against stored hash
  - Uses: `crypt()` from pgcrypto
  - Critical: Login will fail without correct search_path

- **`create_user_with_password(username text, password text, role text)`**
  - Purpose: Creates new user with hashed password
  - Uses: `crypt()` and `gen_salt()` from pgcrypto
  - Critical: User creation will fail without correct search_path

- **`create_user_with_password(username text, password text, role text, display_name text)`**
  - Purpose: Creates new user with hashed password and display name (overload)
  - Uses: `crypt()` and `gen_salt()` from pgcrypto
  - Critical: User creation will fail without correct search_path

- **`change_user_password(user_id uuid, new_password text)`**
  - Purpose: Updates user's password with new hash
  - Uses: `crypt()` and `gen_salt()` from pgcrypto
  - Critical: Password changes will fail without correct search_path

- **`verify_system_code(code_input text)`**
  - Purpose: Verifies admin system verification code
  - Uses: `crypt()` from pgcrypto
  - Critical: Admin operations will fail without correct search_path

- **`reset_admin_password(verification_code text, new_password text)`**
  - Purpose: Emergency password reset for admin account
  - Uses: `crypt()` and `gen_salt()` from pgcrypto
  - Critical: Account recovery will fail without correct search_path

### 2. Utility Functions

These functions use `search_path = public, pg_temp`:

- **`update_updated_at_column()`**
  - Purpose: Trigger function to update updated_at timestamp
  - Dependencies: None
  - Safe to use standard search_path

- **`update_content_reference_updated_at()`**
  - Purpose: Trigger function for content_references table
  - Dependencies: None
  - Safe to use standard search_path

- **`is_admin()`**
  - Purpose: Helper function to check if current user is admin
  - Dependencies: None
  - Safe to use standard search_path

### 3. Analytics Functions

These functions use `search_path = public, pg_temp`:

- `get_user_saved_contents_count(user_uuid uuid)`
- `get_user_progress_summary(target_user_id uuid)`
- `get_spelling_rankings()`
- `get_proofreading_rankings()`
- `get_class_analytics_summary(date_from timestamptz, date_to timestamptz)`
- `get_all_students_performance()`
- `get_student_detailed_analytics(target_user_id uuid)`
- `get_practice_activity_timeline(days_back int)`
- `get_performance_distribution(practice_type text)`
- `get_recent_activity(limit_count int)`

All analytics functions can safely use standard search_path as they don't depend on external extensions.

### 4. Assignment Functions

These functions use `search_path = public, pg_temp`:

- `get_user_assigned_memorizations(target_user_id uuid)`
- `get_memorization_assignment_stats(target_content_id uuid)`
- `get_user_assigned_proofreading_practices(target_user_id uuid)`
- `get_proofreading_assignment_stats(target_practice_id uuid)`
- `get_recommended_voice(p_accent_code text)`

All assignment functions can safely use standard search_path.

### 5. Health Check Function

- **`run_system_health_check()`**
  - Purpose: Comprehensive system health verification
  - Uses: `crypt()` and `gen_salt()` for testing
  - Requires: `search_path = public, extensions, pg_temp`
  - Critical: Must be able to test pgcrypto functionality

## Testing After Changes

**Before declaring any security changes complete, you MUST:**

1. Run the system health check:
   ```sql
   SELECT run_system_health_check();
   ```

2. Verify the overall_status is 'HEALTHY'

3. Check that all critical tests pass:
   - pgcrypto_extension_access: PASS
   - password_hashing: PASS
   - password_verification: PASS
   - verify_password_function: PASS
   - verify_system_code_function: PASS

4. Run the authentication integration tests:
   ```bash
   npm test src/test/integration/auth.test.ts
   ```

## Extension Dependencies

### pgcrypto Extension

- **Schema**: `extensions`
- **Functions Provided**:
  - `crypt(password text, salt text) -> text` - Hash a password
  - `gen_salt(type text) -> text` - Generate a salt for hashing
- **Used By**: All authentication functions
- **Critical**: System authentication depends on this extension

### uuid-ossp Extension

- **Schema**: `extensions`
- **Functions Provided**:
  - `uuid_generate_v4()` - Generate random UUIDs
- **Used By**: Default values in table definitions
- **Note**: Mostly used in DDL, not in stored functions

## Security Best Practices

### When Creating New Functions

1. **Default to restrictive search_path**: Use `public, pg_temp` unless you have a specific reason to include other schemas

2. **Document extension dependencies**: If your function uses an external extension, document it clearly and include the extension's schema in search_path

3. **Always use SECURITY DEFINER carefully**: Only use SECURITY DEFINER when necessary and always set an explicit search_path

4. **Test after creation**: Verify the function works correctly and doesn't expose any security vulnerabilities

### When Modifying Existing Functions

1. **Check for extension dependencies**: Before changing search_path, verify the function doesn't use extension functions

2. **Use grep to find crypt/gen_salt usage**:
   ```bash
   grep -r "crypt\|gen_salt" supabase/migrations/
   ```

3. **Test authentication after changes**: Always verify login still works after modifying any function's search_path

4. **Run health check**: Execute `SELECT run_system_health_check();` to verify all critical systems

### When Applying Security Fixes

**⚠️ NEVER apply blanket search_path changes to all functions without checking dependencies first!**

Use this checklist:

- [ ] Identify which functions use external extensions
- [ ] Group functions by their dependencies
- [ ] Apply search_path changes per group, not globally
- [ ] Test each group of functions after changes
- [ ] Run system health check
- [ ] Test login functionality manually
- [ ] Run integration tests
- [ ] Document what was changed and why

## Recovery Procedures

### If Login Breaks After Security Changes

1. **Check function search_path**:
   ```sql
   SELECT p.proname, pg_get_functiondef(p.oid)
   FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public'
   AND p.proname IN ('verify_password', 'create_user_with_password', 'change_user_password');
   ```

2. **Verify pgcrypto location**:
   ```sql
   SELECT extnamespace::regnamespace::text as schema_name
   FROM pg_extension
   WHERE extname = 'pgcrypto';
   ```

3. **Fix search_path** (if extensions schema is missing):
   ```sql
   ALTER FUNCTION public.verify_password(uuid, text)
     SET search_path = public, extensions, pg_temp;

   ALTER FUNCTION public.create_user_with_password(text, text, text)
     SET search_path = public, extensions, pg_temp;

   ALTER FUNCTION public.create_user_with_password(text, text, text, text)
     SET search_path = public, extensions, pg_temp;

   ALTER FUNCTION public.change_user_password(uuid, text)
     SET search_path = public, extensions, pg_temp;

   ALTER FUNCTION public.verify_system_code(text)
     SET search_path = public, extensions, pg_temp;
   ```

4. **Run health check**:
   ```sql
   SELECT run_system_health_check();
   ```

5. **Reset admin password if needed**:
   ```sql
   SELECT reset_admin_password('949182', '64165644');
   ```

## Migration Templates

### Template: Creating a Function That Uses pgcrypto

```sql
CREATE OR REPLACE FUNCTION my_crypto_function(input_data text)
RETURNS text AS $$
BEGIN
  -- Your function logic here
  RETURN extensions.crypt(input_data, extensions.gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp;
```

### Template: Creating a Regular Function

```sql
CREATE OR REPLACE FUNCTION my_regular_function(input_data text)
RETURNS text AS $$
BEGIN
  -- Your function logic here
  RETURN input_data || '_processed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
```

### Template: Modifying Function search_path

```sql
-- For functions that use pgcrypto
ALTER FUNCTION public.my_crypto_function(text)
  SET search_path = public, extensions, pg_temp;

-- For regular functions
ALTER FUNCTION public.my_regular_function(text)
  SET search_path = public, pg_temp;
```

## Checklist for Database Changes

Use this checklist when making any database changes:

### Before Making Changes
- [ ] Identify which functions will be affected
- [ ] Check if any affected functions use external extensions
- [ ] Document the purpose of the changes
- [ ] Plan rollback procedure if needed

### During Changes
- [ ] Apply changes incrementally
- [ ] Test after each logical group of changes
- [ ] Monitor for errors or warnings
- [ ] Keep track of what was changed

### After Changes
- [ ] Run system health check: `SELECT run_system_health_check();`
- [ ] Verify overall_status is 'HEALTHY'
- [ ] Test login manually with valid credentials
- [ ] Run integration tests: `npm test src/test/integration/auth.test.ts`
- [ ] Verify all critical functionality works
- [ ] Document any issues encountered and how they were resolved

## Version History

- **2025-11-27**: Initial documentation created after authentication system recovery
  - Documented search_path requirements for all function categories
  - Added recovery procedures for broken authentication
  - Created function templates and checklists
