-- One unused join secret per Luanti account (Stage 1 hardening)

CREATE UNIQUE INDEX IF NOT EXISTS idx_luanti_join_secrets_one_active
  ON public.luanti_join_secrets (luanti_account_id)
  WHERE used_at IS NULL;

COMMENT ON INDEX public.idx_luanti_join_secrets_one_active IS
  'Enforces at most one unused join secret per luanti_account';
