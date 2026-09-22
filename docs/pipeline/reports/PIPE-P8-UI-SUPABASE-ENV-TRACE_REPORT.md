# PIPE-P8-UI-SUPABASE-ENV-TRACE — Supabase Env Trace Report

## 1. Scope Confirmation
- **Current task**: Trace Correct Supabase Project / Frontend Env for Learning Hub.
- **Mode**: Environment trace only.
- **Out of scope**: Modifying source code, creating or editing `.env.local`, installing packages, creating new Supabase projects, or running local Supabase.
- **Security rules**: Do not ask the user for keys, do not print secret values, redact any secret-like values found in files.

## 2. Current Blocker
- Vite starts correctly on `http://localhost:5180`.
- React app displays a white screen on load.
- Missing Supabase environment variables cause an uncaught error at `client.ts`: `Uncaught Error: supabaseUrl is required.`
- Required environment variable names: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## 3. Files Inspected
- `src/integrations/supabase/client.ts`
- `.env.local`
- `supabase/config.toml`
- `cloudbuild.yaml`
- `src/main.tsx`
- `src/App.tsx`

## 4. Supabase References Found
- **`supabase/config.toml`**: Contains the project reference: `project_id = "lpyhtbvycxqjjqpwjxyh"`.
- **`cloudbuild.yaml`**: Contains hardcoded build arguments for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (values have been redacted for security, but they correspond to the project ref above).

## 5. Evidence About Intended Project
- **Project Name Evidence**: Referenced as "learning-hub" in Google Cloud Run deployment configuration.
- **Project Ref Evidence**: The project reference ID is `lpyhtbvycxqjjqpwjxyh`.
- **Deployment Evidence**: The project is configured to be built via Google Cloud Build (`cloudbuild.yaml`) and deployed to Google Cloud Run as a container image (`gcr.io/$PROJECT_ID/learning-hub`). The Supabase environment variables were injected securely during the Docker build process.
- **Unknowns**: Whether the Supabase project `lpyhtbvycxqjjqpwjxyh` is still active, paused, or deleted on the Supabase platform.

## 6. Local Development Options
- **Use existing correct Supabase project**: Possible if `lpyhtbvycxqjjqpwjxyh` is still active and accessible.
- **Recover env from old machine/deployment**: Highly feasible, as the credentials exist in `cloudbuild.yaml`.
- **Create new Supabase project later**: A fallback option if the original project is permanently deleted.
- **Local Supabase**: Can be initialized using the existing `supabase/` folder, but requires setup.
- **Frontend mock/fallback later**: Would require modifying `client.ts` to prevent top-level client initialization failure.

## 7. Impact on UI E2E Test
The UI E2E test is completely blocked. The Supabase client is initialized at the module level in `src/integrations/supabase/client.ts`. As soon as any component imports this file (which happens synchronously as `App.tsx` loads the `AuthContext` and others), the application throws an uncaught exception and halts rendering. The Local Markdown Pipeline admin page cannot be accessed because the app crashes before React Router can mount any isolated routes.

## 8. Recommendation
**Recover env from old machine / deployment platform**
Specifically, extract the redacted anon key and URL found in `cloudbuild.yaml`, place them in your `.env.local`, and verify if the project `lpyhtbvycxqjjqpwjxyh` is still operational. If it is not operational, we will need to explore creating a new Supabase project later.

## 9. Final Stop
Stopping after documentation generation. Waiting for human confirmation before proceeding with any state-changing operations (such as `.env.local` creation, source code changes, or Supabase setup).
