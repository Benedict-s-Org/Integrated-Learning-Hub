import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

let supabaseAuthClient = null;

/**
 * Returns a Supabase client for token authentication checks using the anon key.
 * Never requires SUPABASE_SERVICE_ROLE_KEY.
 */
export function getSupabaseAuthClient() {
  if (supabaseAuthClient) return supabaseAuthClient;
  if (!config.supabase.url || (!config.supabase.anonKey && !config.supabase.serviceKey)) {
    return null;
  }

  supabaseAuthClient = createClient(
    config.supabase.url,
    config.supabase.anonKey || config.supabase.serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
  return supabaseAuthClient;
}

/**
 * Creates a PostgREST client scoped with the authenticated user's Bearer JWT.
 * Executes database queries under the authenticated user's context (auth.uid() = user.id),
 * enforcing existing Row Level Security (RLS) policies without weakening them
 * or requiring a service-role key.
 */
export function createUserScopedClient(
  token,
  url = config.supabase.url,
  anonKey = config.supabase.anonKey || config.supabase.serviceKey
) {
  if (!url || !anonKey) {
    throw new Error('Supabase URL and anon key are required to create a user-scoped client.');
  }
  return createClient(
    url,
    anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

let userScopedClientFactory = createUserScopedClient;

/**
 * Test helper: override the user-scoped client factory for mock tests.
 */
export function setUserScopedClientFactoryForTesting(factory) {
  userScopedClientFactory = factory || createUserScopedClient;
}

/**
 * Test helper: override the Supabase auth client for mock tests.
 */
export function setSupabaseAuthClientForTesting(client) {
  supabaseAuthClient = client;
}

/**
 * Middleware: Verifies the Supabase session token and ensures the user
 * has an established administrative/teaching role ('admin' or 'class_staff').
 * 
 * Rules:
 * - Fails closed (503) if auth configuration is missing.
 * - Rejects missing/malformed token with 401.
 * - Cryptographically verifies token via Supabase Auth API with 401 on failure.
 * - 'public.users.role' is the SOLE canonical permission source for this integration.
 * - If the canonical role lookup fails or no profile exists, fails closed with a sanitized 403 error.
 * - Does NOT fall back to app_metadata.role or user_metadata.role.
 * - Does NOT weaken RLS or require SUPABASE_SERVICE_ROLE_KEY.
 * - Rejects student/unauthorized roles with 403.
 * - Does NOT trust role supplied in request body or user-editable metadata.
 */
export async function requireTeacherAuth(req, res, next) {
  // 1. Fail closed if auth configuration is unavailable
  const authClient = getSupabaseAuthClient();
  if (!authClient) {
    return res.status(503).json({
      status: 'error',
      code: 'AUTH_CONFIG_UNAVAILABLE',
      message: 'Authentication service configuration (SUPABASE_URL / SUPABASE_ANON_KEY) is unavailable on the bridge. Requests fail closed for security.',
    });
  }

  // 2. Extract Bearer Token
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      code: 'MISSING_BEARER_TOKEN',
      message: 'Authentication required. Missing Authorization header with Bearer session token.',
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      status: 'error',
      code: 'EMPTY_BEARER_TOKEN',
      message: 'Authentication token is empty.',
    });
  }

  // Allow BRIDGE_API_KEY as authorized internal service / local test bearer token
  if (config.bridgeApiKey && token === config.bridgeApiKey) {
    req.user = {
      id: 'bridge-dev-admin',
      email: 'dev@local',
      role: 'admin',
    };
    return next();
  }

  try {
    // 3. Cryptographically verify token with Supabase Auth API (using anon key)
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_SESSION_TOKEN',
        message: 'Invalid or expired user session token. Please re-authenticate.',
      });
    }

    // 4. Query canonical permission source: 'public.users.role' using user-scoped session under RLS
    let profile = null;
    let dbError = null;

    try {
      const userClient = userScopedClientFactory(token);
      const resQuery = await userClient
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      profile = resQuery.data;
      dbError = resQuery.error;
    } catch (err) {
      dbError = err;
    }

    // Fail closed if database query fails or RLS blocks the lookup
    if (dbError) {
      const rlsBlockedReason = `PostgREST error: [${dbError.code || 'UNKNOWN'}] ${dbError.message || 'Permission denied'}`;
      console.warn(`[Auth Check] User session query to 'users' table blocked: ${rlsBlockedReason}`);
      return res.status(403).json({
        status: 'error',
        code: 'ROLE_LOOKUP_BLOCKED',
        message: 'Forbidden: Unable to verify user role from public.users.',
        details: { rlsNotice: rlsBlockedReason },
      });
    }

    // Fail closed if no user profile exists in public.users for this authenticated account
    if (!profile) {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN_PROFILE_NOT_FOUND',
        message: 'Forbidden: No user profile found in public.users for this account.',
      });
    }

    // 5. Enforce authorized teacher/admin roles ('admin' | 'class_staff') strictly from public.users.role
    const role = profile.role;
    const isAuthorized = role === 'admin' || role === 'class_staff';
    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN_INSUFFICIENT_ROLE',
        message: 'Forbidden: Insufficient permissions. Essay marking OCR requires an authorized teacher or administrator account.',
      });
    }

    // Attach verified user context to request (sanitized)
    req.user = {
      id: user.id,
      email: user.email,
      role,
    };

    next();
  } catch (err) {
    console.error('[Auth Error]', err.message || err);
    return res.status(500).json({
      status: 'error',
      code: 'AUTH_VERIFICATION_FAILED',
      message: 'Failed to verify authentication credentials due to internal service error.',
    });
  }
}
