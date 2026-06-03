CREATE OR REPLACE FUNCTION public.get_abby_full_audit()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'practice_stats', (
      SELECT jsonb_build_object(
        'spelling', (SELECT COUNT(*) FROM public.spelling_practice_results WHERE user_id = 'a021ca6b-9ec5-492d-bd9d-eace437ae382'),
        'proofreading', (SELECT COUNT(*) FROM public.proofreading_practice_results WHERE user_id = 'a021ca6b-9ec5-492d-bd9d-eace437ae382'),
        'memorization', (SELECT COUNT(*) FROM public.memorization_practice_sessions WHERE user_id = 'a021ca6b-9ec5-492d-bd9d-eace437ae382'),
        'reading', (SELECT COUNT(*) FROM public.reading_student_responses WHERE student_id = 'a021ca6b-9ec5-492d-bd9d-eace437ae382'),
        'sr', (SELECT COUNT(*) FROM public.spaced_repetition_attempts WHERE user_id = 'a021ca6b-9ec5-492d-bd9d-eace437ae382')
      )
    ),
    'room_data', (
      SELECT jsonb_build_object(
        'coins', coins,
        'virtual_coins', virtual_coins,
        'daily_counts', daily_counts
      ) FROM public.user_room_data WHERE user_id = 'a021ca6b-9ec5-492d-bd9d-eace437ae382'
    ),
    'records_summary', (
      SELECT jsonb_build_object(
        'total_count', COUNT(*),
        'reverted_count', COUNT(*) FILTER (WHERE is_reverted),
        'active_sum', SUM(coin_amount) FILTER (WHERE NOT is_reverted),
        'total_sum', SUM(coin_amount)
      ) FROM public.student_records WHERE student_id = 'a021ca6b-9ec5-492d-bd9d-eace437ae382'
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
