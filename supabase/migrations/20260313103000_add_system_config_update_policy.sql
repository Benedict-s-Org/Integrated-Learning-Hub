-- Update system_config policies to allow both admin and class_staff
-- This ensures theme settings persist for all staff roles and across view modes

-- 1. SELECT Policy (Read)
DROP POLICY IF EXISTS "Public can read dashboard theme" ON system_config;
DROP POLICY IF EXISTS "Admins can read system config" ON system_config;
-- Allow both roles to read. Using USING clause for better role matching.
CREATE POLICY "Staff and public can read theme" 
  ON system_config
  FOR SELECT
  TO public
  USING (key = 'dashboard_theme');

-- 2. UPDATE Policy (Write)
DROP POLICY IF EXISTS "Admins can update system config" ON system_config;
CREATE POLICY "Staff can update theme"
  ON system_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'class_staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'class_staff')
    )
  );
