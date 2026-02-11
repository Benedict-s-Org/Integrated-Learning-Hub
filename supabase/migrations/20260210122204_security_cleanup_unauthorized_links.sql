
-- Security Cleanup: Remove unauthorized or temporary test links from production
-- Specifically removing the local test token that was accidentally pushed/created
DELETE FROM public.shared_links 
WHERE token = '1f95afc1514609cbe4fb029554aafb32';

-- Ensure the correct production token exists and is active
-- We already have a seed migration for this, but this serves as a double-check
INSERT INTO public.shared_links (token, created_by, type, target_class, is_active)
VALUES ('class-3a-dashboard-2026', NULL, 'class_dashboard', '3A', true)
ON CONFLICT (token) DO UPDATE 
SET is_active = true, target_class = '3A';
