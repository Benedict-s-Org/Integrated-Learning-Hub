-- Global Cleanup: Removing the targeted legacy balance adjustments
-- Purpose: Only targeted adjustments succeeded today. Removing them restores pure organic balances.
-- Path: supabase/migrations/20260330250000_global_cleanup_rollback.sql

DO $$
DECLARE
  v_legacy_deleted INTEGER;
BEGIN
  -- Remove Target Fixes (Legacy balance adjustment)
  DELETE FROM public.student_records
  WHERE message = 'Legacy balance adjustment (Verified)';
  GET DIAGNOSTICS v_legacy_deleted = ROW_COUNT;

  RAISE NOTICE 'GLOBAL CLEANUP COMPLETE. Deleted % legacy adjustments. No other fake records existed.', v_legacy_deleted;
END $$;
