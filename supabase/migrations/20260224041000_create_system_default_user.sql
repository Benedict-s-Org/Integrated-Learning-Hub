-- Migration: Create System Default User
-- Description: Inserts a system user with ID 00000000-0000-0000-0000-000000000000 to serve as the master default template.

INSERT INTO public.users (id, username, role, display_name, created_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'system_default', 'user', '系統預設 (Master Default)', NOW())
ON CONFLICT (id) DO UPDATE SET display_name = '系統預設 (Master Default)';

INSERT INTO public.user_profiles (id, display_name, created_at)
VALUES ('00000000-0000-0000-0000-000000000000', '系統預設 (Master Default)', NOW())
ON CONFLICT (id) DO UPDATE SET display_name = '系統預設 (Master Default)';
