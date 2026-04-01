-- Temporary audit migration for Ben's toilet breaks
DO $$
DECLARE
  v_toilet_coins INTEGER;
  v_total_coins INTEGER;
  v_break_count INTEGER;
  r RECORD;
BEGIN
  -- 1. Check user_room_data
  SELECT toilet_coins, coins INTO v_toilet_coins, v_total_coins 
  FROM user_room_data WHERE user_id = '656c89ec-0c5a-40da-819f-f4fd044916d4';
  
  RAISE NOTICE 'AUDIT: Ben current toilet_coins = %, total_coins = %', v_toilet_coins, v_total_coins;

  -- 2. Check student_records for Toilet/Break
  SELECT COUNT(*) INTO v_break_count 
  FROM student_records WHERE student_id = '656c89ec-0c5a-40da-819f-f4fd044916d4' AND message ILIKE '%toilet%';
  
  RAISE NOTICE 'AUDIT: Ben toilet records in student_records: %', v_break_count;

  -- 3. List the records
  FOR r IN 
    SELECT message, created_at FROM student_records 
    WHERE student_id = '656c89ec-0c5a-40da-819f-f4fd044916d4' AND message ILIKE '%toilet%'
  LOOP
    RAISE NOTICE 'AUDIT: Record: % %', r.created_at, r.message;
  END LOOP;

  -- 4. Check coin_transactions
  SELECT COUNT(*) INTO v_break_count 
  FROM coin_transactions WHERE user_id = '656c89ec-0c5a-40da-819f-f4fd044916d4' AND reason ILIKE '%toilet%';
  
  RAISE NOTICE 'AUDIT: Ben toilet records in coin_transactions: %', v_break_count;
END $$;
