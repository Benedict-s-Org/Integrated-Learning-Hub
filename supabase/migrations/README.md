# Database Migrations

## ⚠️ CRITICAL WARNING: Authentication Dependencies

**BEFORE making ANY changes to function security settings or search_path configurations:**

1. Read `/docs/DATABASE_FUNCTIONS.md` completely
2. Understand which functions depend on the `pgcrypto` extension
3. Test changes incrementally
4. Run health checks after each change

### Functions That MUST Have `extensions` in search_path

These functions use pgcrypto's `crypt()` and `gen_salt()` functions:

- `verify_password()`
- `create_user_with_password()` (both overloads)
- `change_user_password()`
- `verify_system_code()`
- `reset_admin_password()`
- `run_system_health_check()`

**Setting search_path without `extensions` will break authentication and users cannot log in!**

## Migration Best Practices

### Creating New Migrations

1. Use descriptive filenames with timestamp prefix
2. Include comprehensive comments at the top explaining:
   - What the migration does
   - Why it's needed
   - What tables/functions/policies are affected
   - Any security implications
   - Dependencies on extensions

3. Test migrations locally before applying to production
4. Include rollback instructions in comments if applicable

### Security-Related Migrations

**⚠️ NEVER apply blanket security changes!**

When updating function security settings:

```sql
-- ❌ WRONG - Breaks authentication
ALTER FUNCTION public.verify_password(uuid, text)
  SET search_path = public, pg_temp;

-- ✅ CORRECT - Maintains functionality
ALTER FUNCTION public.verify_password(uuid, text)
  SET search_path = public, extensions, pg_temp;
```

### Testing Migrations

After applying any migration that affects functions:

```sql
-- Run system health check
SELECT run_system_health_check();

-- Expected result: overall_status should be 'HEALTHY'
-- All critical tests should be 'PASS'
```

## Migration History Highlights

### Authentication System Fixes

- **20251127060655**: Fixed search_path for auth functions to include `extensions` schema
- **20251127060734**: Added emergency admin password reset utility
- **20251127061424**: Created system health check function

### Security Improvements

- **20251127034517**: Added search_path security to functions (caused login issues)
- **20251127034537**: Continued search_path security improvements

**Lesson Learned**: The security improvements in migrations 034517 and 034537 broke authentication because they didn't account for pgcrypto dependency. Migration 060655 fixed this by adding `extensions` back to the search_path.

## Emergency Recovery

If authentication breaks after a migration:

1. Check if pgcrypto functions are accessible:
   ```sql
   SELECT extensions.gen_salt('bf');
   ```

2. Fix authentication functions:
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

3. Reset admin password if needed:
   ```sql
   SELECT reset_admin_password('949182', '64165644');
   ```

## Resources

- Full documentation: `/docs/DATABASE_FUNCTIONS.md`
- Integration tests: `/src/test/integration/auth.test.ts`
- Health check function: `run_system_health_check()`

## Pre-Migration Checklist

Before applying any migration:

- [ ] Read the migration SQL file completely
- [ ] Understand what will be changed
- [ ] Check if any authentication functions are affected
- [ ] Verify extension dependencies are maintained
- [ ] Have rollback plan ready
- [ ] Test in local environment first

After applying migration:

- [ ] Run: `SELECT run_system_health_check();`
- [ ] Verify overall_status is 'HEALTHY'
- [ ] Test login manually
- [ ] Run integration tests if available
- [ ] Document any issues

## Questions?

If you're unsure about a migration:

1. Check `/docs/DATABASE_FUNCTIONS.md` for function documentation
2. Run the health check to verify current system state
3. Test changes incrementally
4. Ask for review before applying to production

**When in doubt, test thoroughly. A broken authentication system means no one can log in.**
