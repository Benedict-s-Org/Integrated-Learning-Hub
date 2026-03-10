-- Allow public read access for broadcast settings in system_config
-- This is required for the BroadcastBoard to function in guest mode

DROP POLICY IF EXISTS "Public can read broadcast settings" ON system_config;

CREATE POLICY "Public can read broadcast settings"
  ON system_config
  FOR SELECT
  USING (key = 'broadcast_v2_settings');
