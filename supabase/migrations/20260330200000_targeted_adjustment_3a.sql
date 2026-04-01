-- Targeted Adjustment: Final Fix for Ben, Abby, and Olyvia
-- Purpose: Add a single, clean adjustment record for each student to match their verified targets.
-- Path: supabase/migrations/20260330200000_targeted_adjustment_3a.sql

DO $$
DECLARE
  v_ben_id UUID;
  v_abby_id UUID;
  v_olyvia_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- 1. Find the IDs by display name (flexible lookup)
  SELECT id INTO v_abby_id FROM users WHERE display_name ILIKE '%Abby%' OR username ILIKE '%Abby%' LIMIT 1;
  SELECT id INTO v_olyvia_id FROM users WHERE display_name ILIKE '%Olyvia%' OR username ILIKE '%Olyvia%' LIMIT 1;
  SELECT id INTO v_ben_id FROM users WHERE display_name ILIKE '%Ben%' OR username ILIKE '%Ben%' LIMIT 1;

  -- 2. Insert for Ben (+40 to reach 310)
  IF v_ben_id IS NOT NULL THEN
    INSERT INTO public.student_records (student_id, type, message, coin_amount, created_at)
    VALUES (v_ben_id, 'positive', 'Legacy balance adjustment (Verified)', 40, NOW() - interval '1 minute');
    v_count := v_count + 1;
  ELSE
    RAISE WARNING 'Student Ben not found in users table.';
  END IF;

  -- 3. Insert for Abby (+40 to reach 540)
  IF v_abby_id IS NOT NULL THEN
    INSERT INTO public.student_records (student_id, type, message, coin_amount, created_at)
    VALUES (v_abby_id, 'positive', 'Legacy balance adjustment (Verified)', 40, NOW() - interval '2 minutes');
    v_count := v_count + 1;
  ELSE
    RAISE WARNING 'Student Abby not found in users table.';
  END IF;

  -- 4. Insert for Olyvia (+50 to reach 290)
  IF v_olyvia_id IS NOT NULL THEN
    INSERT INTO public.student_records (student_id, type, message, coin_amount, created_at)
    VALUES (v_olyvia_id, 'positive', 'Legacy balance adjustment (Verified)', 50, NOW() - interval '3 minutes');
    v_count := v_count + 1;
  ELSE
    RAISE WARNING 'Student Olyvia not found in users table.';
  END IF;

  RAISE NOTICE 'Targeted Fix Applied: Inserted % adjustment records.', v_count;
END $$;
