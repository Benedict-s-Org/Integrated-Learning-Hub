-- Stage 1: Luanti Learning Community foundation
-- Account link, short-lived join secrets, admin audit log

CREATE TABLE IF NOT EXISTS public.luanti_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  luanti_username text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT luanti_accounts_username_format
    CHECK (luanti_username ~ '^[a-z0-9_]{1,20}$')
);

CREATE INDEX IF NOT EXISTS idx_luanti_accounts_user_id
  ON public.luanti_accounts(user_id);

CREATE TABLE IF NOT EXISTS public.luanti_join_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  luanti_account_id uuid NOT NULL REFERENCES public.luanti_accounts(id) ON DELETE CASCADE,
  password_plaintext text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_luanti_join_secrets_account
  ON public.luanti_join_secrets(luanti_account_id);

CREATE INDEX IF NOT EXISTS idx_luanti_join_secrets_active
  ON public.luanti_join_secrets(expires_at)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON public.admin_audit_log(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON public.admin_audit_log(action);

ALTER TABLE public.luanti_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.luanti_join_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Students/admins can read their own Luanti account link
DROP POLICY IF EXISTS luanti_accounts_select_own ON public.luanti_accounts;
CREATE POLICY luanti_accounts_select_own
  ON public.luanti_accounts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all account links
DROP POLICY IF EXISTS luanti_accounts_select_admin ON public.luanti_accounts;
CREATE POLICY luanti_accounts_select_admin
  ON public.luanti_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Join secrets: no direct client access (Edge Function uses service role)
DROP POLICY IF EXISTS luanti_join_secrets_deny_all ON public.luanti_join_secrets;
CREATE POLICY luanti_join_secrets_deny_all
  ON public.luanti_join_secrets
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Audit log: admins can read
DROP POLICY IF EXISTS admin_audit_log_select_admin ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select_admin
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

COMMENT ON TABLE public.luanti_accounts IS
  '1:1 link from Learning Hub users to Luanti usernames (Stage 1)';
COMMENT ON TABLE public.luanti_join_secrets IS
  'Short-lived join passwords minted by Hub; readable only via service role / auth-sync';
COMMENT ON TABLE public.admin_audit_log IS
  'Administrator and system actions for Learning Community / Luanti ops';
