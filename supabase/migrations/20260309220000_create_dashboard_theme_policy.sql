-- Create migration for dashboard_theme key in system_config

-- Insert the default theme configuration if it doesn't exist
INSERT INTO system_config (key, value)
VALUES (
  'dashboard_theme',
  '{"cardBg": "#ffffff", "cardText": "#374151", "coinBg": "#f0fdf4", "coinText": "#15803d", "coinBorder": "#dcfce3", "dailyEarnedBg": "#ffedd5", "dailyEarnedText": "#9a3412", "dailyEarnedBorder": "#fed7aa"}'
)
ON CONFLICT (key) DO NOTHING;

-- Drop policy if it exists to be safe
DROP POLICY IF EXISTS "Public can read dashboard theme" ON system_config;

-- Create policy allowing anyone (including unauthenticated guests) to read the theme
CREATE POLICY "Public can read dashboard theme"
  ON system_config
  FOR SELECT
  USING (key = 'dashboard_theme');
