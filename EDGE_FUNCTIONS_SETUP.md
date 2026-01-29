# Edge Functions Setup Guide

## Problem
The edge functions require the `SUPABASE_SERVICE_ROLE_KEY` to be configured as a secret in your Supabase project. Without this key, database operations fail with 401 insufficient_privilege errors.

## Solution

### Step 1: Get Your Service Role Key

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `coerbxuptinniypfhlvx`
3. Go to **Settings** > **API**
4. Under **Project API keys**, find the **service_role** key (NOT the anon key)
5. Copy this key (it will be a long JWT token)

### Step 2: Configure the Secret in Edge Functions

You have two options:

#### Option A: Using Supabase Dashboard (Recommended)

1. In your Supabase Dashboard, go to **Edge Functions**
2. Click on **Manage secrets** or **Configuration**
3. Add a new secret:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: [paste the service_role key you copied]
4. Save the secret

#### Option B: Using Supabase CLI (If Available)

If you have the Supabase CLI installed locally:

```bash
# Set the secret for all edge functions
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Step 3: Verify the Configuration

After setting the secret:

1. Try creating an assignment again in your app
2. If you still get errors, check the browser console and network tab
3. The error should now be more specific if the secret is still missing

### Step 4: Redeploy Functions (If Needed)

If the secret was set but functions were already deployed, you may need to redeploy them:

1. In Supabase Dashboard, go to **Edge Functions**
2. Select each function and click **Redeploy** or **Deploy**
3. Or use the deploy tool in this project

## Security Notes

- NEVER commit the service_role key to git
- NEVER expose it in client-side code
- Only use it in edge functions (server-side)
- The service_role key bypasses Row Level Security, so handle it carefully

## Troubleshooting

### Still getting 401 errors?

1. Verify the secret is set correctly (no extra spaces, complete token)
2. Check that SUPABASE_URL is also available as an environment variable
3. Redeploy the edge functions after setting secrets
4. Check edge function logs in Supabase Dashboard for detailed errors

### How to verify the secret is set?

The updated edge functions now return a clear error message if the secret is missing:
```
"Server configuration error: Missing required environment variables"
```

If you see this error, the secret is not configured properly.
