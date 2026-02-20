-- Update get_user_progress_summary to include Spaced Repetition statistics

CREATE OR REPLACE FUNCTION get_user_progress_summary(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'spelling', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage)), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0)
      )
      FROM spelling_practice_results
      WHERE user_id = target_user_id
    ),
    'proofreading', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage)), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0)
      )
      FROM proofreading_practice_results
      WHERE user_id = target_user_id
    ),
    'memorization', (
      SELECT jsonb_build_object(
        'total_sessions', COUNT(*),
        'total_time_minutes', COALESCE(ROUND(SUM(session_duration_seconds) / 60.0), 0),
        'total_words_practiced', COALESCE(SUM(total_words), 0)
      )
      FROM memorization_practice_sessions
      WHERE user_id = target_user_id
    ),
    'spaced_repetition', (
      SELECT jsonb_build_object(
        'total_practices', (SELECT COUNT(*) from spaced_repetition_attempts WHERE user_id = target_user_id),
        'average_accuracy', (
            SELECT COALESCE(ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END)), 0)
            FROM spaced_repetition_attempts
            WHERE user_id = target_user_id
        ),
        'total_time_minutes', (
            SELECT COALESCE(ROUND(SUM(COALESCE(response_time_ms, 0)) / 60000.0), 0)
            FROM spaced_repetition_attempts
            WHERE user_id = target_user_id
        ),
        'mastery_count', (
            SELECT COUNT(*) 
            FROM spaced_repetition_schedules 
            WHERE user_id = target_user_id AND interval_days >= 21
        )
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;
