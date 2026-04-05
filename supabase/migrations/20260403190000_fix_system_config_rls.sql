-- Fix RLS for system_config to allow staff to manage Holiday Mode
-- These policies expand on previous theme-only policies.

-- 1. DROP old restrictive policies if they exist
DROP POLICY IF EXISTS "Staff and public can read theme" ON system_config;
DROP POLICY IF EXISTS "Staff can update theme" ON system_config;
DROP POLICY IF EXISTS "Admins can read system config" ON system_config;
DROP POLICY IF EXISTS "Admins can update system config" ON system_config;

-- 2. CREATE broad SELECT policy for Staff
CREATE POLICY "Staff can read all system config"
  ON system_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role IN ('admin', 'class_staff')
    )
  );

-- 3. CREATE broad UPDATE policy for Staff
CREATE POLICY "Staff can update all system config"
  ON system_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role IN ('admin', 'class_staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role IN ('admin', 'class_staff')
    )
  );

-- 4. Maintain public READ for specific keys if needed (e.g. theme)
CREATE POLICY "Public can read specific config"
  ON system_config
  FOR SELECT
  TO public
  USING (key IN ('dashboard_theme', 'holiday_mode', 'manual_holiday_dates'));
