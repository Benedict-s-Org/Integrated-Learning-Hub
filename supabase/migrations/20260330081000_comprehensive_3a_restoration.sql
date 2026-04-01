-- Migration: Comprehensive restoration of missing coins for Class 3A
-- Path: supabase/migrations/20260330081000_comprehensive_3a_restoration.sql

DO $$
DECLARE
  r RECORD;
  v_count INTEGER := 0;
BEGIN
  -- 1. Restore Spelling Practices
  FOR r IN 
    SELECT spr.user_id, spr.id, spr.title, 5 as coins, spr.completed_at
    FROM spelling_practice_results spr
    JOIN users u ON spr.user_id = u.id
    WHERE u.class = '3A' AND spr.completed_at > now() - interval '30 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM student_records 
      WHERE student_id = r.user_id 
      AND (message ILIKE '%' || r.title || '%' OR message ILIKE '%spelling%')
      AND created_at BETWEEN r.completed_at - interval '2 minutes' AND r.completed_at + interval '2 minutes'
    ) THEN
      INSERT INTO student_records (student_id, type, message, coin_amount, created_at, created_by)
      VALUES (r.user_id, 'positive', '完成spelling: ' || r.title || ' (遺失獎勵補回)', r.coins, r.completed_at, NULL);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- 2. Restore Proofreading Practices
  FOR r IN 
    SELECT ppr.user_id, ppr.id, 'Proofreading' as title, 5 as coins, ppr.completed_at
    FROM proofreading_practice_results ppr
    JOIN users u ON ppr.user_id = u.id
    WHERE u.class = '3A' AND ppr.completed_at > now() - interval '30 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM student_records 
      WHERE student_id = r.user_id 
      AND (message ILIKE '%proofreading%')
      AND created_at BETWEEN r.completed_at - interval '2 minutes' AND r.completed_at + interval '2 minutes'
    ) THEN
      INSERT INTO student_records (student_id, type, message, coin_amount, created_at, created_by)
      VALUES (r.user_id, 'positive', '完成proofreading (遺失獎勵補回)', r.coins, r.completed_at, NULL);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- 3. Restore Memorization Sessions
  FOR r IN 
    SELECT mps.user_id, mps.id, mps.title, 5 as coins, mps.completed_at
    FROM memorization_practice_sessions mps
    JOIN users u ON mps.user_id = u.id
    WHERE u.class = '3A' AND mps.completed_at > now() - interval '30 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM student_records 
      WHERE student_id = r.user_id 
      AND (message ILIKE '%' || r.title || '%' OR message ILIKE '%memorization%')
      AND created_at BETWEEN r.completed_at - interval '2 minutes' AND r.completed_at + interval '2 minutes'
    ) THEN
      INSERT INTO student_records (student_id, type, message, coin_amount, created_at, created_by)
      VALUES (r.user_id, 'positive', '完成memorization: ' || r.title || ' (遺失獎勵補回)', r.coins, r.completed_at, NULL);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Restored % missing coin records for Class 3A from practices.', v_count;
END $$;
