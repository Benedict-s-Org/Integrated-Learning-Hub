-- Migration: Restore missing coins for Class 3A students
-- Path: supabase/migrations/20260330054000_restore_missing_coins_3a.sql

DO $$
DECLARE
  r RECORD;
  v_count INTEGER := 0;
BEGIN
  -- 1. Restore Spelling Assignments
  FOR r IN 
    SELECT a.user_id, a.id, p.title, COALESCE(p.reward_coins, 5) as coins, a.completed_at
    FROM practice_assignments a
    JOIN spelling_practices p ON a.practice_id = p.id
    JOIN users u ON a.user_id = u.id
    WHERE u.class = '3A' AND a.completed = true AND a.completed_at > now() - interval '30 days'
  LOOP
    -- Check if record exists
    IF NOT EXISTS (
      SELECT 1 FROM student_records 
      WHERE student_id = r.user_id 
      AND (message ILIKE '%' || r.title || '%' OR message ILIKE '%spelling%')
      AND created_at BETWEEN r.completed_at - interval '1 minute' AND r.completed_at + interval '1 minute'
    ) THEN
      INSERT INTO student_records (student_id, type, message, coin_amount, created_at, created_by)
      VALUES (r.user_id, 'positive', '完成spelling: ' || r.title || ' (遺失獎勵補回)', r.coins, r.completed_at, NULL);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- 2. Restore Memorization Assignments
  FOR r IN 
    SELECT a.user_id, a.id, COALESCE(c.title, 'Memorization') as title, 5 as coins, a.completed_at
    FROM memorization_assignments a
    LEFT JOIN saved_contents c ON a.content_id = c.id
    JOIN users u ON a.user_id = u.id
    WHERE u.class = '3A' AND a.completed = true AND a.completed_at > now() - interval '30 days'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM student_records 
      WHERE student_id = r.user_id 
      AND (message ILIKE '%' || r.title || '%' OR message ILIKE '%memorization%')
      AND created_at BETWEEN r.completed_at - interval '1 minute' AND r.completed_at + interval '1 minute'
    ) THEN
      INSERT INTO student_records (student_id, type, message, coin_amount, created_at, created_by)
      VALUES (r.user_id, 'positive', '完成memorization: ' || r.title || ' (遺失獎勵補回)', r.coins, r.completed_at, NULL);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- 3. Sync Balances (Wait! We'll do this manually from the UI to avoid a hidden bug)
  -- PERFORM rebuild_user_balances();
  
  RAISE NOTICE 'Restored % missing coin records for Class 3A.', v_count;
END $$;
