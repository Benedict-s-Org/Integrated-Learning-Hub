# Documentation

This folder contains comprehensive documentation for the application's authentication and database systems.

## Quick Start

**If authentication is broken**, read these in order:

1. **SECURITY_CHECKLIST.md** - Quick fix guide
2. **AUTHENTICATION_SYSTEM.md** - System overview and troubleshooting
3. **DATABASE_FUNCTIONS.md** - Detailed function documentation

## Documents

### SECURITY_CHECKLIST.md
**Purpose**: Quick reference for making security changes safely

**Use when**:
- Before modifying any database function
- Before applying security-related migrations
- Authentication stops working after changes

**Contains**:
- Pre/post change checklists
- Quick commands for common tasks
- Emergency recovery procedures
- Red flags to watch for

### AUTHENTICATION_SYSTEM.md
**Purpose**: Complete authentication system documentation

**Use when**:
- Understanding how authentication works
- Troubleshooting login issues
- Setting up new environments
- Training new developers

**Contains**:
- System architecture
- Authentication flow
- Dependencies and why they matter
- Common issues and solutions
- Emergency procedures

### DATABASE_FUNCTIONS.md
**Purpose**: Comprehensive database function reference

**Use when**:
- Creating new database functions
- Modifying existing functions
- Understanding function dependencies
- Applying security patches

**Contains**:
- Function categories and requirements
- search_path requirements by function type
- Extension dependencies
- Testing procedures
- Migration templates
- Recovery procedures

## Common Scenarios

### Scenario 1: Login stopped working after a migration

1. Open **SECURITY_CHECKLIST.md**
2. Go to "What To Do If You Break Authentication"
3. Run the health check
4. Follow the recovery commands
5. Read **AUTHENTICATION_SYSTEM.md** to understand what happened

### Scenario 2: Creating a new database function

1. Open **DATABASE_FUNCTIONS.md**
2. Find the appropriate function template
3. Determine if your function needs extensions
4. Use the correct search_path
5. Test using the provided commands

### Scenario 3: Applying a security fix

1. Open **SECURITY_CHECKLIST.md**
2. Complete the "Pre-Change Checklist"
3. Make changes incrementally
4. Run health checks after each change
5. Complete the "Post-Change Checklist"
6. Document what you changed

### Scenario 4: Need to reset admin password

1. Open **AUTHENTICATION_SYSTEM.md**
2. Go to "Emergency Procedures" > "Lost Admin Password"
3. Run the provided SQL command
4. Verify login works

## Key Concepts

### Why search_path Matters

PostgreSQL's `search_path` determines which schemas are searched for functions and tables. The authentication system depends on pgcrypto functions in the `extensions` schema.

**Correct**:
```sql
SET search_path = public, extensions, pg_temp;
-- Can access crypt() and gen_salt()
```

**Wrong**:
```sql
SET search_path = public, pg_temp;
-- Cannot access crypt() and gen_salt()
-- AUTHENTICATION BREAKS!
```

### Critical Functions

These 6 functions MUST have `extensions` in search_path:
1. verify_password
2. create_user_with_password (both overloads = 2 functions)
3. change_user_password
4. verify_system_code
5. reset_admin_password

If ANY of these cannot access pgcrypto, authentication breaks.

### Health Check Function

`run_system_health_check()` is your first line of defense:

```sql
SELECT run_system_health_check();
```

Run this:
- After any migration
- After modifying functions
- When login isn't working
- Before declaring changes complete
- As part of regular maintenance

## Testing

### Manual Testing Checklist

- [ ] Can log in with valid credentials
- [ ] Cannot log in with invalid credentials
- [ ] Can create new user (as admin)
- [ ] Can change password
- [ ] New password works for login
- [ ] System code verification works

### Automated Testing

```bash
# Run authentication tests
npm run test:auth

# Run all integration tests
npm run test:integration

# Run all tests
npm test
```

### Database Testing

```sql
-- Health check
SELECT run_system_health_check();

-- Test password hashing manually
SELECT extensions.crypt('test', extensions.gen_salt('bf'));

-- Verify admin exists
SELECT username, role FROM users WHERE username = 'admin';
```

## Troubleshooting Guide

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Invalid username or password" with correct credentials | search_path missing extensions | Fix search_path (see SECURITY_CHECKLIST.md) |
| Health check shows FAIL | Function cannot access dependencies | Check search_path includes extensions |
| Cannot create users | create_user_with_password broken | Fix search_path for that function |
| Password change fails | change_user_password broken | Fix search_path for that function |
| All auth fails | Multiple functions broken | Run all fixes from SECURITY_CHECKLIST.md |

## Best Practices

1. **Always test after changes**
   - Run health check
   - Test login manually
   - Run integration tests

2. **Never apply blanket changes**
   - Check function dependencies first
   - Group functions by requirements
   - Apply changes incrementally

3. **Document your changes**
   - Note what you changed and why
   - Record any issues encountered
   - Update version history in docs

4. **When in doubt**
   - Check the documentation
   - Run the health check
   - Ask for review
   - Test in local environment first

## Getting Help

If you encounter issues not covered here:

1. Run the health check and note all failures
2. Check the Edge Function logs in Supabase dashboard
3. Review recent migrations for changes to auth functions
4. Check git history for recent changes to database functions
5. Read the complete documentation in this folder

## Maintenance

### Keep Documentation Updated

When you:
- Add new authentication features
- Modify security configurations
- Discover new issues or solutions
- Change function dependencies

Update the relevant documentation and note it in version history.

### Regular Reviews

- Monthly: Review and update documentation
- Quarterly: Audit function configurations
- After incidents: Document lessons learned

## Credits

This documentation was created after a critical authentication failure caused by search_path security changes. The incident taught us:

1. Security fixes can break functionality
2. Dependencies must be explicitly documented
3. Testing must be comprehensive
4. Recovery procedures must be accessible
5. Documentation prevents recurring issues

**Date**: November 27, 2025
**Reason**: Security hardening broke authentication by removing extensions from search_path
**Resolution**: Fixed search_path and created comprehensive documentation
**Prevention**: This documentation and automated testing
