-- Rebuild shared_links for Class Dashboard magic links (scoped guest access).
-- Does NOT restore broad anon RLS on sensitive tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.shared_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  type text NOT NULL DEFAULT 'class_dashboard',
  description text,
  target_class text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  allowed_cidrs text[] DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS shared_links_one_active_class_dashboard
  ON public.shared_links (target_class)
  WHERE (is_active = true AND type = 'class_dashboard');

CREATE INDEX IF NOT EXISTS idx_shared_links_token ON public.shared_links (token);

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage shared links" ON public.shared_links;
CREATE POLICY "Admins can manage shared links" ON public.shared_links
  FOR ALL TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_links TO authenticated;
GRANT ALL ON public.shared_links TO service_role;

CREATE OR REPLACE FUNCTION public.deactivate_shared_links_on_class_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_archived IS TRUE AND (OLD.is_archived IS DISTINCT FROM TRUE) THEN
    UPDATE public.shared_links
    SET is_active = false
    WHERE type = 'class_dashboard'
      AND target_class = NEW.name
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_shared_links_on_class_archive ON public.classes;
CREATE TRIGGER trg_deactivate_shared_links_on_class_archive
  AFTER UPDATE OF is_archived ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.deactivate_shared_links_on_class_archive();
