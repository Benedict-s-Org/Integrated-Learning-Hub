-- Migration: Comprehensive Toilet/Break Bonus Restoration for Class 3A
-- Purpose: Backfill all missing weekly bonuses since the system started on March 10, 2026.
-- Logic: Each Monday, students get 100 - (Number of Toilet Breaks * 20) added to their balance.
-- Path: supabase/migrations/20260330180000_comprehensive_toilet_restoration_3a.sql

DO $$
DECLARE
  v_start_date DATE := '2026-03-10'; -- Approx start of the system
  v_today DATE := CURRENT_DATE;
  v_current_monday DATE;
  v_week_start DATE;
  v_week_end DATE;
  v_student RECORD;
  v_num_breaks INTEGER;
  v_bonus_amount INTEGER;
  v_inserted_count INTEGER := 0;
BEGIN
  -- Iterate through every Monday from start to today
  v_current_monday := v_start_date;
  WHILE v_current_monday <= v_today LOOP
    -- Adjust to the nearest Monday if start was not a Monday
    v_current_monday := date_trunc('week', v_current_monday)::DATE;
    
    v_week_start := v_current_monday - interval '7 days';
    v_week_end := v_current_monday - interval '1 second';

    -- Find all students in Class 3A
    FOR v_student IN SELECT id, COALESCE(display_name, username) as name FROM users WHERE class = '3A' AND role = 'user' LOOP
      
      -- Count toilet breaks in the previous week
      SELECT COUNT(*) INTO v_num_breaks
      FROM public.student_records
      WHERE student_id = v_student.id
        AND message ILIKE '%Toilet/Break%'
        AND created_at BETWEEN v_week_start AND v_week_end;

      v_bonus_amount := 100 - (v_num_breaks * 20);

      IF v_bonus_amount > 0 THEN
        -- Check if bonus already exists for this Monday
        IF NOT EXISTS (
          SELECT 1 FROM public.student_records 
          WHERE student_id = v_student.id 
          AND message ILIKE 'Weekly Toilet/Break Bonus (+%'
          AND created_at::DATE = v_current_monday
        ) THEN
          -- Insert the missing bonus
          INSERT INTO public.student_records (
            student_id, 
            type, 
            message, 
            coin_amount, 
            created_at, 
            created_by
          ) VALUES (
            v_student.id, 
            'positive', 
            'Weekly Toilet/Break Bonus (+' || v_bonus_amount || ')', 
            v_bonus_amount, 
            (v_current_monday + interval '9 hours'), -- Log it around 9 AM HK time
            NULL
          );
          v_inserted_count := v_inserted_count + 1;
        END IF;
      END IF;
    END LOOP;

    v_current_monday := v_current_monday + interval '7 days';
  END LOOP;

  RAISE NOTICE 'Restored % missing Weekly Toilet/Break Bonus records for Class 3A.', v_inserted_count;
END $$;
