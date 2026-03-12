-- Migration: Remove Guest Mode Functionality
-- Path: supabase/migrations/20260312001500_remove_guest_mode.sql

-- 1. Revoke public/anon access permissions
REVOKE SELECT ON public.student_records FROM anon;
REVOKE SELECT ON public.user_room_data FROM anon;
REVOKE SELECT ON public.daily_homework FROM anon;
REVOKE SELECT ON public.class_rewards FROM anon;
REVOKE ALL ON public.shared_links FROM anon;
REVOKE ALL ON public.pending_rewards FROM anon;

-- 2. Drop Guest-specific Policies
DROP POLICY IF EXISTS "Allow public select" ON public.class_rewards;
DROP POLICY IF EXISTS "Anyone can view student records" ON public.student_records;
DROP POLICY IF EXISTS "Anyone can view room data" ON public.user_room_data;
DROP POLICY IF EXISTS "Public can read broadcast settings" ON public.system_config;
DROP POLICY IF EXISTS "Anyone can read daily_homework" ON public.daily_homework;

-- 3. Re-add restrictive policies for internal use (if needed)
-- For daily_homework, we still want authenticated users (students/staff) to be able to read.
CREATE POLICY "Authenticated users can read daily_homework" ON public.daily_homework
    FOR SELECT
    TO authenticated
    USING (true);

-- 4. Drop Guest-specific Tables
DROP TABLE IF EXISTS public.pending_rewards;
DROP TABLE IF EXISTS public.shared_links;

-- 5. Revoke service_role grants for deleted tables (cleanup)
-- Note: These are automatically revoked when the table is dropped, but good for tracking.
