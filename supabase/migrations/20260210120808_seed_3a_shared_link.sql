
-- Seed a shared link for the 3A Class Dashboard on production
-- This uses a subquery to find any existing admin for the 'created_by' field
INSERT INTO public.shared_links (token, created_by, type, target_class)
VALUES ('class-3a-dashboard-2026', NULL, 'class_dashboard', '3A')
ON CONFLICT (token) DO UPDATE 
SET target_class = EXCLUDED.target_class;
