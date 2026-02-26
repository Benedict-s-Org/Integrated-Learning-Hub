-- Seed a shared link for the 4D Class Dashboard on production
INSERT INTO public.shared_links (token, created_by, type, target_class, is_active)
VALUES ('4d-dashbaord', NULL, 'class_dashboard', '4D', true)
ON CONFLICT (token) DO UPDATE
SET target_class = EXCLUDED.target_class,
    is_active = true;
