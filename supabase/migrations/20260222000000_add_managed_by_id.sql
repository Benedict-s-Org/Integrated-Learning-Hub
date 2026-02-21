-- Add managed_by_id column to public.users
-- This column tracks which admin manages each user for multi-admin isolation.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS managed_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: Tag ALL existing users with the Super Admin (first admin created)
DO $$
DECLARE
  super_admin_id UUID;
BEGIN
  SELECT id INTO super_admin_id
  FROM public.users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF super_admin_id IS NOT NULL THEN
    UPDATE public.users
    SET managed_by_id = super_admin_id
    WHERE managed_by_id IS NULL;
  END IF;
END $$;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_users_managed_by_id ON public.users(managed_by_id);
