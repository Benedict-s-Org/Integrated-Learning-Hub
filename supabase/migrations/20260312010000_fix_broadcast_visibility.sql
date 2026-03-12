-- Allow authenticated users to read broadcast settings in system_config
-- Restoration of policies dropped during guest mode removal

-- 1. Restore SELECT access to system_config for relevant keys
DROP POLICY IF EXISTS "Authenticated users can read broadcast settings" ON public.system_config;
CREATE POLICY "Authenticated users can read broadcast settings"
  ON public.system_config
  FOR SELECT
  TO authenticated
  USING (key = 'broadcast_v2_settings' OR key = 'dashboard_theme');

-- 2. Restore SELECT access to student_records for all authenticated users
-- This allows BroadcastBoard to aggregate today's records for alerts/homework
DROP POLICY IF EXISTS "Authenticated users can view student records" ON public.student_records;
CREATE POLICY "Authenticated users can view student records"
  ON public.student_records
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Ensure grants are present (just in case)
GRANT SELECT ON public.system_config TO authenticated;
GRANT SELECT ON public.student_records TO authenticated;

-- 4. Allow authenticated users to read student directory names/classes for joins
DROP POLICY IF EXISTS "Anyone can view student names and classes" ON public.users;
CREATE POLICY "Anyone can view student names and classes"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT (id, display_name, class) ON public.users TO authenticated;
