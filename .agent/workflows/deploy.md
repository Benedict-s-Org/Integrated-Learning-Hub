---
description: How to deploy frontend changes and Supabase Edge Functions
---

To deploy your changes to the online environment, follow these steps:

### 1. Deploy Frontend Changes
Pushing to `main` runs the Cloud Build trigger (`cloudbuild.yaml` → Docker → Cloud Run `learning-hub`).

```bash
git push origin main
```

If History shows a red build, open the failed build and check the Docker step. The image runs `npx vite build` (not full `npm run build` / `tsc`), so typecheck debt should not block deploy.

To redeploy without a new commit: Cloud Build → Triggers → **Run**.

### 2. Deploy Supabase Edge Functions
If you have modified any Edge Functions (e.g., `supabase/functions/auth/index.ts`), you must deploy them separately using the Supabase CLI.

```bash
# Deploy a specific function
supabase functions deploy auth

# Or deploy all functions
supabase functions deploy
```

> [!NOTE]
> If you haven't configured your Supabase secrets yet, refer to `EDGE_FUNCTIONS_SETUP.md` for instructions on setting the `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Verify Deployment
Once pushed and deployed:
1. Check the build status on your deployment platform (e.g., Lovable, GitHub Actions, or Google Cloud Build).
2. Visit the online URL to confirm the scrolling fix is active.
3. Test a login or an authenticated action to ensure the Edge Functions are working correctly.
