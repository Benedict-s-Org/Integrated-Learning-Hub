-- Migration: Restoration of missing coin_amount for historical toilet break and bonus records
-- Path: supabase/migrations/20260330112000_restore_toilet_coin_data.sql

DO $$
DECLARE
  r RECORD;
  v_amount INTEGER;
  v_count INTEGER := 0;
BEGIN
  -- 1. Restore Weekly Toilet/Break Bonuses (+X)
  FOR r IN 
    SELECT id, message FROM student_records 
    WHERE (coin_amount IS NULL OR coin_amount = 0) 
      AND message LIKE 'Weekly Toilet/Break Bonus (+%)'
  LOOP
    -- Extract number from message like 'Weekly Toilet/Break Bonus (+100)'
    BEGIN
      v_amount := substring(r.message from '\+(\d+)')::INTEGER;
      IF v_amount IS NOT NULL THEN
        UPDATE student_records SET coin_amount = v_amount WHERE id = r.id;
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to parse amount from message: %', r.message;
    END;
  END LOOP;

  -- 2. Restore Individual Toilet/Break Deductions (-20)
  -- These records historically didn't have the amount in the message, 
  -- but we know they were all -20 based on the code.
  UPDATE student_records 
  SET coin_amount = -20 
  WHERE (coin_amount IS NULL OR coin_amount = 0) 
    AND message = 'Toilet/Break';
    
  GET DIAGNOSTICS v_amount = ROW_COUNT;
  v_count := v_count + v_amount;

  RAISE NOTICE 'Restored coin_amount for % toilet-related student records.', v_count;
END $$;
