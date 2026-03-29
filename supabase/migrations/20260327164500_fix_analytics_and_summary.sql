-- 1. Fix get_user_progress_summary to return empty objects instead of NULL for empty categories
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
    'spelling', COALESCE((
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage)), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0)
      )
      FROM spelling_practice_results
      WHERE user_id = target_user_id
    ), jsonb_build_object('total_practices', 0, 'average_accuracy', 0, 'total_time_minutes', 0, 'best_score', 0)),
    'proofreading', COALESCE((
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage)), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0)
      )
      FROM proofreading_practice_results
      WHERE user_id = target_user_id
    ), jsonb_build_object('total_practices', 0, 'average_accuracy', 0, 'total_time_minutes', 0, 'best_score', 0)),
    'memorization', COALESCE((
      SELECT jsonb_build_object(
        'total_sessions', COUNT(*),
        'total_time_minutes', COALESCE(ROUND(SUM(session_duration_seconds) / 60.0), 0),
        'total_words_practiced', COALESCE(SUM(total_words), 0)
      )
      FROM memorization_practice_sessions
      WHERE user_id = target_user_id
    ), jsonb_build_object('total_sessions', 0, 'total_time_minutes', 0, 'total_words_practiced', 0)),
    'spaced_repetition', COALESCE((
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
    ), jsonb_build_object('total_practices', 0, 'average_accuracy', 0, 'total_time_minutes', 0, 'mastery_count', 0))
  ) INTO result;

  RETURN result;
END;
$$;

-- 2. Create get_overall_analytics_summary to provide detailed global stats for UserAnalytics.tsx
CREATE OR REPLACE FUNCTION get_overall_analytics_summary(date_from timestamptz DEFAULT NULL, date_to timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
  total_students int;
  active_students int;
BEGIN
  -- Get student counts
  SELECT COUNT(*) INTO total_students FROM users WHERE role = 'user';

  SELECT COUNT(DISTINCT user_id) INTO active_students
  FROM (
    SELECT user_id FROM spelling_practice_results
    WHERE (date_from IS NULL OR completed_at >= date_from)
      AND (date_to IS NULL OR completed_at <= date_to)
    UNION
    SELECT user_id FROM proofreading_practice_results
    WHERE (date_from IS NULL OR completed_at >= date_from)
      AND (date_to IS NULL OR completed_at <= date_to)
    UNION
    SELECT user_id FROM memorization_practice_sessions
    WHERE (date_from IS NULL OR completed_at >= date_from)
      AND (date_to IS NULL OR completed_at <= date_to)
     UNION
    SELECT user_id FROM spaced_repetition_attempts
    WHERE (date_from IS NULL OR created_at >= date_from)
      AND (date_to IS NULL OR created_at <= date_to)
  ) AS active_users;

  SELECT jsonb_build_object(
    'total_students', total_students,
    'active_students', active_students,
    'inactive_students', total_students - active_students,
    'spelling', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'unique_students', COUNT(DISTINCT user_id),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0),
        'median_accuracy', COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY accuracy_percentage), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0),
        'worst_score', COALESCE(MIN(accuracy_percentage), 0),
        'total_time_hours', COALESCE(ROUND(SUM(time_spent_seconds) / 3600.0, 1), 0),
        'avg_time_minutes', COALESCE(ROUND(AVG(time_spent_seconds) / 60.0, 1), 0),
        'score_distribution', (
          SELECT jsonb_build_object(
            'excellent', COUNT(*) FILTER (WHERE accuracy_percentage >= 90),
            'good', COUNT(*) FILTER (WHERE accuracy_percentage >= 70 AND accuracy_percentage < 90),
            'needs_improvement', COUNT(*) FILTER (WHERE accuracy_percentage < 70)
          )
          FROM spelling_practice_results
          WHERE (date_from IS NULL OR completed_at >= date_from)
            AND (date_to IS NULL OR completed_at <= date_to)
        )
      )
      FROM spelling_practice_results
      WHERE (date_from IS NULL OR completed_at >= date_from)
        AND (date_to IS NULL OR completed_at <= date_to)
    ),
    'proofreading', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'unique_students', COUNT(DISTINCT user_id),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0),
        'median_accuracy', COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY accuracy_percentage), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0),
        'worst_score', COALESCE(MIN(accuracy_percentage), 0),
        'total_time_hours', COALESCE(ROUND(SUM(time_spent_seconds) / 3600.0, 1), 0),
        'avg_time_minutes', COALESCE(ROUND(AVG(time_spent_seconds) / 60.0, 1), 0),
        'score_distribution', (
          SELECT jsonb_build_object(
            'excellent', COUNT(*) FILTER (WHERE accuracy_percentage >= 90),
            'good', COUNT(*) FILTER (WHERE accuracy_percentage >= 70 AND accuracy_percentage < 90),
            'needs_improvement', COUNT(*) FILTER (WHERE accuracy_percentage < 70)
          )
          FROM proofreading_practice_results
          WHERE (date_from IS NULL OR completed_at >= date_from)
            AND (date_to IS NULL OR completed_at <= date_to)
        )
      )
      FROM proofreading_practice_results
      WHERE (date_from IS NULL OR completed_at >= date_from)
        AND (date_to IS NULL OR completed_at <= date_to)
    ),
    'memorization', (
      SELECT jsonb_build_object(
        'total_sessions', COUNT(*),
        'unique_students', COUNT(DISTINCT user_id),
        'total_words_practiced', COALESCE(SUM(total_words), 0),
        'avg_words_per_session', COALESCE(ROUND(AVG(total_words), 1), 0),
        'total_time_hours', COALESCE(ROUND(SUM(session_duration_seconds) / 3600.0, 1), 0),
        'avg_time_minutes', COALESCE(ROUND(AVG(session_duration_seconds) / 60.0, 1), 0)
      )
      FROM memorization_practice_sessions
      WHERE (date_from IS NULL OR completed_at >= date_from)
        AND (date_to IS NULL OR completed_at <= date_to)
    ),
    'spaced_repetition', (
      SELECT jsonb_build_object(
        'total_practices', (SELECT COUNT(*) from spaced_repetition_attempts),
        'unique_students', (SELECT COUNT(DISTINCT user_id) from spaced_repetition_attempts),
        'average_accuracy', (
            SELECT COALESCE(ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END), 1), 0)
            FROM spaced_repetition_attempts
        ),
        'total_time_hours', (
            SELECT COALESCE(ROUND(SUM(COALESCE(response_time_ms, 0)) / 3600000.0, 1), 0)
            FROM spaced_repetition_attempts
        ),
        'avg_time_minutes', (
            SELECT COALESCE(ROUND(AVG(COALESCE(response_time_ms, 0)) / 60000.0, 1), 0)
            FROM spaced_repetition_attempts
        )
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;
