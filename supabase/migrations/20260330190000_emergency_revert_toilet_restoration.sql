-- Emergency Revert: Remove recent Mass Toilet/Break Bonus records
-- Purpose: Immediately undo the bulk restoration from Turn 38 which caused unexpected balance jumps and user frustration.
-- Path: supabase/migrations/20260330190000_emergency_revert_toilet_restoration.sql

DELETE FROM public.student_records
WHERE (message ILIKE 'Weekly Toilet/Break Bonus (+%)' OR message ILIKE '完成%獎勵補回%')
  AND created_at::DATE = '2026-03-30'
  AND student_id IN (SELECT id FROM users WHERE class = '3A');

-- Verify deletion
DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Emergency: Deleted % records that were added in the recent mass restoration.', v_deleted_count;
END $$;
