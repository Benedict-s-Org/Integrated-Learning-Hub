-- Revert Toilet Values: Set historical Weekly Toilet/Break Bonuses back to 0
-- Purpose: The mass restoration of actual coin values (+100) to historical toilet bonuses artificially inflated all student balances to 700-800. This sets their coin_impact back to 0, leaving the logs harmless.
-- Path: supabase/migrations/20260330230000_revert_toilet_bonus_impact.sql

UPDATE public.student_records
SET coin_amount = 0
WHERE message ILIKE 'Weekly Toilet/Break Bonus (+%' 
  AND student_id IN (SELECT id FROM users WHERE class = '3A');

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Reverted coin_amount to 0 for % Weekly Toilet/Break Bonus records in Class 3A.', v_count;
END $$;
