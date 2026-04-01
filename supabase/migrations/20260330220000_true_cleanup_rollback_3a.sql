-- True Cleanup Rollback: Remove ALL mass restorations from today
-- Purpose: The previous reverts failed due to mismatched substring matching and retro-active dates. This script explicitly removes all bulk-inserted records from today.
-- Path: supabase/migrations/20260330220000_true_cleanup_rollback_3a.sql

DELETE FROM public.student_records
WHERE student_id IN (SELECT id FROM users WHERE class = '3A')
  AND (
       message ILIKE '%(遺失預設獎勵)%'               -- The practice restoration (caused the +200 class-wide jump)
       OR message ILIKE 'Weekly Toilet/Break Bonus (+%'  -- The toilet bonus restoration (retro-active dates)
       OR message = 'Legacy balance adjustment (Verified)' -- The targeted adjustments
  );

-- Verify deletion
DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'True Cleanup: Deleted % incorrectly restored records for Class 3A. Balances will now return to their original pristine state.', v_deleted_count;
END $$;
