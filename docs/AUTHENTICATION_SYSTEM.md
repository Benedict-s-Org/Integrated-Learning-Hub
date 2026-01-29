# Authentication System Overview

## System Architecture

The authentication system uses a custom username/password implementation with PostgreSQL's pgcrypto extension for secure password hashing.

### Components

1. **Database Layer**
   - `users` table with username and hashed passwords
   - pgcrypto extension for bcrypt password hashing
   - Authentication helper functions
   - Row Level Security (RLS) policies

2. **Edge Functions**
   - `/auth/login` - Login endpoint
   - `/auth/create-user` - User creation (admin only)
   - `/auth/bulk-create-users` - Bulk user creation (admin only)
   - `/auth/change-password` - Password change endpoint
   - `/auth/verify-code` - System code verification
   - `/auth/list-users` - User management (admin only)
   - `/auth/delete-user` - User deletion (admin only)
   - `/auth/update-permissions` - Permission management (admin only)

3. **Frontend**
   - `AuthContext` - React context for authentication state
   - `Login` component - User interface for login
   - `AuthStatus` component - Display current user info

### Authentication Flow

```
1. User enters username/password
   ↓
2. Frontend calls /functions/v1/auth/login
   ↓
3. Edge function queries users table
   ↓
4. Edge function calls verify_password() RPC
   ↓
5. verify_password() uses pgcrypto to check password
   ↓
6. If valid, return user data
   ↓
7. Frontend stores user in localStorage and AuthContext
```

## Critical Dependencies

### pgcrypto Extension

**Location**: `extensions` schema (NOT `public`)

**Functions Used**:
- `crypt(password, salt)` - Hash password or verify against hash
- `gen_salt('bf')` - Generate bcrypt salt

**Why Critical**: Without access to these functions, the entire authentication system breaks. Users cannot log in, passwords cannot be changed, and new users cannot be created.

### Database Functions That Depend on pgcrypto

All of these MUST have `search_path = public, extensions, pg_temp`:

1. **verify_password(user_id uuid, password_input text)**
   - Verifies user password
   - Called during login
   - Returns boolean

2. **create_user_with_password(...)**
   - Creates new user with hashed password
   - Two overloads (with/without display_name)
   - Called by admin for user creation

3. **change_user_password(user_id uuid, new_password text)**
   - Updates user password
   - Clears force_password_change flag
   - Called when user changes password

4. **verify_system_code(code_input text)**
   - Verifies admin system code
   - Used for admin operations
   - Returns boolean

5. **reset_admin_password(verification_code text, new_password text)**
   - Emergency admin password reset
   - Requires system verification code
   - Returns success/error JSON

## Default Credentials

### Admin Account

- **Username**: `admin`
- **Default Password**: `64165644`
- **System Verification Code**: `949182`

**Security Note**: These should be changed in production. The admin account is created with `force_password_change: true` to encourage password changes on first login.

## Testing Authentication

### Manual Testing

1. Try to log in with admin credentials
2. Create a test user (as admin)
3. Log out and log in as test user
4. Change password
5. Log out and log in with new password

### Automated Testing

```bash
# Run authentication integration tests
npm run test:auth

# Run database health check
SELECT run_system_health_check();
```

### Health Check Tests

The `run_system_health_check()` function performs:

1. ✅ pgcrypto extension accessibility
2. ✅ Password hashing functionality
3. ✅ Password verification functionality
4. ✅ verify_password function execution
5. ✅ verify_system_code function execution
6. ✅ Admin user existence

## Common Issues and Solutions

### Issue: "Invalid username or password" with correct credentials

**Symptoms**:
- Login fails with valid credentials
- Health check shows FAIL for password-related tests

**Root Cause**:
Functions cannot access pgcrypto (search_path missing `extensions`)

**Solution**:
```sql
-- Fix search_path for auth functions
ALTER FUNCTION public.verify_password(uuid, text)
  SET search_path = public, extensions, pg_temp;
-- Repeat for other auth functions (see DATABASE_FUNCTIONS.md)
```

**Verify Fix**:
```sql
SELECT run_system_health_check();
-- Should show overall_status: 'HEALTHY'
```

### Issue: Cannot create new users

**Symptoms**:
- User creation fails
- Error mentions crypt() or gen_salt()

**Root Cause**:
`create_user_with_password()` cannot access pgcrypto

**Solution**:
```sql
ALTER FUNCTION public.create_user_with_password(text, text, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.create_user_with_password(text, text, text, text)
  SET search_path = public, extensions, pg_temp;
```

### Issue: Password changes fail

**Symptoms**:
- Password change operation fails
- Old password accepted but new password not saved

**Root Cause**:
`change_user_password()` cannot access pgcrypto

**Solution**:
```sql
ALTER FUNCTION public.change_user_password(uuid, text)
  SET search_path = public, extensions, pg_temp;
```

## Security Considerations

### Password Storage

- Passwords are hashed using bcrypt (blowfish algorithm)
- Salt is generated per-password using `gen_salt('bf')`
- Raw passwords are NEVER stored in database
- Password hashes are NEVER returned in API responses

### Function Security

- All auth functions use `SECURITY DEFINER` to bypass RLS
- All auth functions have explicit `search_path` set
- Edge functions use service role key for database operations
- Frontend uses anon key (cannot access service role operations)

### Row Level Security

- Users table has RLS enabled
- Users can only read their own data (unless admin)
- Admins can read all user data
- Password hashes are in SELECT but should never be exposed in API

### Search Path Security

**Why we set search_path**:

Without explicit search_path, PostgreSQL uses the connection's search_path, which could be manipulated to cause the function to execute malicious code from an attacker-controlled schema.

**Our pattern**:
- `public` - Our application schema
- `extensions` - Supabase extensions (pgcrypto, uuid-ossp)
- `pg_temp` - Temporary objects for current session
- **NOT** `public, extensions, pg_temp, "$user"` - Would allow user schema injection

## Emergency Procedures

### Lost Admin Password

```sql
-- Use system verification code to reset
SELECT reset_admin_password('949182', 'new_secure_password_here');
```

### Authentication Completely Broken

1. Check health status:
   ```sql
   SELECT run_system_health_check();
   ```

2. Review error messages in test results

3. Most likely need to fix search_path:
   ```sql
   -- See DATABASE_FUNCTIONS.md for complete list
   ALTER FUNCTION public.verify_password(uuid, text)
     SET search_path = public, extensions, pg_temp;
   -- ... etc
   ```

4. Verify fix:
   ```sql
   SELECT run_system_health_check();
   ```

5. Test login manually

### Edge Function Not Responding

1. Check Edge Function logs in Supabase dashboard
2. Verify CORS headers are present
3. Check environment variables are set:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - SUPABASE_ANON_KEY

4. Verify Edge Function is deployed:
   ```bash
   # Check project files
   ls supabase/functions/auth/
   ```

## Monitoring and Maintenance

### Regular Health Checks

Run weekly or after any database changes:
```sql
SELECT run_system_health_check();
```

Expected result:
```json
{
  "overall_status": "HEALTHY",
  "test_results": [
    {"test": "pgcrypto_extension_access", "status": "PASS"},
    {"test": "password_hashing", "status": "PASS"},
    {"test": "password_verification", "status": "PASS"},
    // ... all should be PASS
  ]
}
```

### Audit Log

Consider logging:
- Failed login attempts
- Password changes
- User creation/deletion
- Admin operations

### Password Policy

Consider implementing:
- Minimum password length (currently not enforced)
- Password complexity requirements
- Password expiration
- Password history (prevent reuse)

## Related Documentation

- **DATABASE_FUNCTIONS.md** - Comprehensive function documentation
- **SECURITY_CHECKLIST.md** - Checklist for security changes
- **supabase/migrations/README.md** - Migration guidelines

## Version History

- **2025-11-27**: Initial comprehensive documentation
  - Created after authentication system recovery
  - Documented architecture, dependencies, and troubleshooting
  - Added emergency procedures and testing guidelines
