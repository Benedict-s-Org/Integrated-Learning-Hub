# Security Changes Checklist

## Purpose

This checklist ensures that security-related changes don't break critical functionality, especially authentication.

## Background

**Problem**: In November 2025, security hardening that set `search_path = public, pg_temp` on all functions broke authentication because pgcrypto functions (needed for password hashing) are in the `extensions` schema.

**Solution**: Functions that use pgcrypto MUST have `search_path = public, extensions, pg_temp`.

## Quick Reference: Which Functions Need What

### Need `extensions` in search_path:
- `verify_password()`
- `create_user_with_password()` (both overloads)
- `change_user_password()`
- `verify_system_code()`
- `reset_admin_password()`
- `run_system_health_check()`

### Standard search_path (`public, pg_temp`):
- All other functions (analytics, utilities, etc.)

## Pre-Change Checklist

Before making ANY security-related changes:

- [ ] I have read `/docs/DATABASE_FUNCTIONS.md`
- [ ] I have identified which functions will be affected
- [ ] I have checked if affected functions use `crypt()` or `gen_salt()`
- [ ] I understand the extension dependencies
- [ ] I have a rollback plan

## Making Changes Checklist

While making changes:

- [ ] I am NOT applying blanket changes to all functions
- [ ] I am grouping functions by their dependencies
- [ ] I am applying changes incrementally
- [ ] I am testing after each logical group of changes

## Post-Change Checklist

After making changes:

- [ ] Run health check: `SELECT run_system_health_check();`
- [ ] Verify result shows `overall_status: 'HEALTHY'`
- [ ] All critical tests show status: 'PASS'
- [ ] Test login manually with valid credentials
- [ ] Run integration tests: `npm run test:auth`
- [ ] Document what was changed

## Red Flags

**STOP and reconsider if:**

- You're about to modify search_path for ALL functions at once
- You're changing search_path without checking extension dependencies
- You haven't tested authentication after the change
- The health check shows any 'FAIL' status
- Login doesn't work after your changes

## Common Commands

### Check current function search_path:
```sql
SELECT p.proname,
       pg_get_function_arguments(p.oid) as args,
       pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('verify_password', 'create_user_with_password', 'change_user_password');
```

### Check pgcrypto location:
```sql
SELECT extnamespace::regnamespace::text as schema_name
FROM pg_extension
WHERE extname = 'pgcrypto';
```

### Run health check:
```sql
SELECT run_system_health_check();
```

### Fix broken auth functions:
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

### Reset admin password (emergency):
```sql
SELECT reset_admin_password('949182', '64165644');
```

## Testing Commands

```bash
# Run all tests
npm test

# Run only authentication tests
npm run test:auth

# Run all integration tests
npm run test:integration

# Build to verify no TypeScript errors
npm run build
```

## What To Do If You Break Authentication

1. **Don't Panic** - You have recovery tools

2. **Check the health status**:
   ```sql
   SELECT run_system_health_check();
   ```

3. **Look for FAIL status** in these critical tests:
   - pgcrypto_extension_access
   - password_hashing
   - password_verification
   - verify_password_function

4. **Most likely cause**: search_path missing `extensions` schema

5. **Fix it**: Run the "Fix broken auth functions" commands above

6. **Verify**: Run health check again and test login

7. **Document**: Write down what happened and what you learned

## Remember

- Authentication breakage affects ALL users
- Test changes before applying to production
- When in doubt, ask for review
- Document your changes
- Keep this checklist updated

## Version History

- **2025-11-27**: Initial version after authentication recovery incident
  - Created after discovering search_path security changes broke login
  - Includes lessons learned and recovery procedures
