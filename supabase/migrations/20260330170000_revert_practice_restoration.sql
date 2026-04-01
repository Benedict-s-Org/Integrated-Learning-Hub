-- Revert Incorrect Practice Rewards
-- Purpose: Remove all (遺失獎勵補回) records added in previous turns after user clarified 'no rewards for practice'
-- Path: supabase/migrations/20260330170000_revert_practice_restoration.sql

DELETE FROM public.student_records
WHERE message ILIKE '%(遺失獎勵補回)%'
  AND student_id IN (SELECT id FROM users WHERE class = '3A');

-- Verify deletion
DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % incorrect practice reward records for Class 3A.', v_deleted_count;
END $$;
