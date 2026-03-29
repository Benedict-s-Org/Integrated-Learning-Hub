-- Migration: Add reward_coins to spelling and proofreading practices
-- Path: supabase/migrations/20260324020000_add_reward_coins_to_all_practices.sql

ALTER TABLE public.spelling_practices ADD COLUMN IF NOT EXISTS reward_coins INTEGER DEFAULT 5;
ALTER TABLE public.proofreading_practices ADD COLUMN IF NOT EXISTS reward_coins INTEGER DEFAULT 5;

-- Ensure reading_practices also has the column (it was added in a previous migration but ensuring here for consistency)
ALTER TABLE public.reading_practices ADD COLUMN IF NOT EXISTS reward_coins INTEGER DEFAULT 10;
