-- Migration: Add public read policies for Guest Mode
-- Path: supabase/migrations/20260309020000_add_public_read_policies.sql

-- Enable anonymous users to view student records (Progress Log)
CREATE POLICY "Anyone can view student records" ON public.student_records
    FOR SELECT TO anon, authenticated
    USING (true);

-- Enable anonymous users to view user room data (Dashboard balances/status)
CREATE POLICY "Anyone can view room data" ON public.user_room_data
    FOR SELECT TO anon, authenticated
    USING (true);

-- Grant select permission to anon role
GRANT SELECT ON public.student_records TO anon;
GRANT SELECT ON public.user_room_data TO anon;
