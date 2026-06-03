-- Migration: Allow authenticated users to insert/update daily_homework
-- Path: supabase/migrations/20260522041700_allow_authenticated_manage_daily_homework.sql

DROP POLICY IF EXISTS "Authenticated users can insert daily_homework" ON public.daily_homework;
CREATE POLICY "Authenticated users can insert daily_homework" ON public.daily_homework
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update daily_homework" ON public.daily_homework;
CREATE POLICY "Authenticated users can update daily_homework" ON public.daily_homework
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
