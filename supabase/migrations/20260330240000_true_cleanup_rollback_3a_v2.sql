-- True Cleanup Rollback V2: Safely remove mass restorations while preserving valid 2 weeks
-- Purpose: Deletes fake practice rewards and retro-active Toilet Bonuses older than March 16th to remove artificial inflation. Preserves legitimate Toilet Break Bonuses and manual teacher rewards.
-- Path: supabase/migrations/20260330240000_true_cleanup_rollback_3a_v2.sql

DO $$
DECLARE
  v_practice_deleted INTEGER;
  v_toilet_fake_deleted INTEGER;
  v_legacy_deleted INTEGER;
BEGIN
  -- 1. Remove Fake Practice Coins (遺失預設獎勵)
  DELETE FROM public.student_records
  WHERE student_id IN (SELECT id FROM users WHERE class = '3A')
    AND message ILIKE '%(遺失預設獎勵)%';
  GET DIAGNOSTICS v_practice_deleted = ROW_COUNT;

  -- 2. Remove Target Fixes (Legacy balance adjustment)
  DELETE FROM public.student_records
  WHERE student_id IN (SELECT id FROM users WHERE class = '3A')
    AND message = 'Legacy balance adjustment (Verified)';
  GET DIAGNOSTICS v_legacy_deleted = ROW_COUNT;

  -- 3. Preserve Valid Toilet Coins, Delete Fake Ones (Older than 2 weeks)
  -- The system has only run for 2 weeks. Any Toilet Bonus prior to March 16th is a fake backfill.
  DELETE FROM public.student_records
  WHERE student_id IN (SELECT id FROM users WHERE class = '3A')
    AND message ILIKE 'Weekly Toilet/Break Bonus (+%'
    AND created_at < '2026-03-16 00:00:00+08';
  GET DIAGNOSTICS v_toilet_fake_deleted = ROW_COUNT;

  RAISE NOTICE 'Cleanup complete for Class 3A. Removed % fake practice logs, % targeted adjustments, and % fake retro-active toilet logs.', v_practice_deleted, v_legacy_deleted, v_toilet_fake_deleted;
END $$;
