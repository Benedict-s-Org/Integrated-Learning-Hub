-- Fix broken subquery alias in get_student_detailed_analytics
-- The 'recent_attempts' subquery references `sq.question_text` and `sra.is_correct`
-- in the outer jsonb_agg, but those aliases only exist INSIDE the subquery.
-- The outer query must reference the subquery alias `recent.*` instead.

CREATE OR REPLACE FUNCTION get_student_detailed_analytics(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
  class_avg_spelling numeric;
  class_avg_proofreading numeric;
  class_avg_sr numeric;
BEGIN
  -- Get class averages for comparison
  SELECT COALESCE(ROUND(AVG(accuracy_percentage), 1), 0) INTO class_avg_spelling
  FROM spelling_practice_results;

  SELECT COALESCE(ROUND(AVG(accuracy_percentage), 1), 0) INTO class_avg_proofreading
  FROM proofreading_practice_results;

  SELECT COALESCE(ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END), 1), 0) INTO class_avg_sr
  FROM spaced_repetition_attempts;

  SELECT jsonb_build_object(
    'user_info', (
      SELECT jsonb_build_object(
        'user_id', id,
        'username', username,
        'display_name', COALESCE(display_name, username)
      )
      FROM users WHERE id = target_user_id
    ),
    'spelling', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0),
        'class_average', class_avg_spelling,
        'compared_to_class', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0) - class_avg_spelling,
        'best_score', COALESCE(MAX(accuracy_percentage), 0),
        'worst_score', COALESCE(MIN(accuracy_percentage), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'recent_practices', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'title', title,
              'accuracy', accuracy_percentage,
              'completed_at', completed_at,
              'time_spent', time_spent_seconds
            ) ORDER BY completed_at DESC
          )
          FROM (
            SELECT title, accuracy_percentage, completed_at, time_spent_seconds
            FROM spelling_practice_results
            WHERE user_id = target_user_id
            ORDER BY completed_at DESC
            LIMIT 10
          ) recent
        ),
        'improvement_trend', (
          SELECT COALESCE(ROUND(AVG(accuracy_percentage) FILTER (WHERE completed_at >= NOW() - INTERVAL '7 days'), 1), 0) -
                 COALESCE(ROUND(AVG(accuracy_percentage) FILTER (WHERE completed_at < NOW() - INTERVAL '7 days'), 1), 0)
          FROM spelling_practice_results
          WHERE user_id = target_user_id
        )
      )
      FROM spelling_practice_results
      WHERE user_id = target_user_id
    ),
    'proofreading', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0),
        'class_average', class_avg_proofreading,
        'compared_to_class', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0) - class_avg_proofreading,
        'best_score', COALESCE(MAX(accuracy_percentage), 0),
        'worst_score', COALESCE(MIN(accuracy_percentage), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'recent_practices', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'sentence_count', array_length(sentences, 1),
              'accuracy', accuracy_percentage,
              'completed_at', completed_at,
              'time_spent', time_spent_seconds
            ) ORDER BY completed_at DESC
          )
          FROM (
            SELECT sentences, accuracy_percentage, completed_at, time_spent_seconds
            FROM proofreading_practice_results
            WHERE user_id = target_user_id
            ORDER BY completed_at DESC
            LIMIT 10
          ) recent
        ),
        'improvement_trend', (
          SELECT COALESCE(ROUND(AVG(accuracy_percentage) FILTER (WHERE completed_at >= NOW() - INTERVAL '7 days'), 1), 0) -
                 COALESCE(ROUND(AVG(accuracy_percentage) FILTER (WHERE completed_at < NOW() - INTERVAL '7 days'), 1), 0)
          FROM proofreading_practice_results
          WHERE user_id = target_user_id
        )
      )
      FROM proofreading_practice_results
      WHERE user_id = target_user_id
    ),
    'memorization', (
      SELECT jsonb_build_object(
        'total_sessions', COUNT(*),
        'total_words_practiced', COALESCE(SUM(total_words), 0),
        'avg_words_per_session', COALESCE(ROUND(AVG(total_words), 1), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(session_duration_seconds) / 60.0), 0),
        'recent_sessions', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'title', title,
              'total_words', total_words,
              'hidden_words', hidden_words_count,
              'completed_at', completed_at,
              'duration', session_duration_seconds
            ) ORDER BY completed_at DESC
          )
          FROM (
            SELECT title, total_words, hidden_words_count, completed_at, session_duration_seconds
            FROM memorization_practice_sessions
            WHERE user_id = target_user_id
            ORDER BY completed_at DESC
            LIMIT 10
          ) recent
        )
      )
      FROM memorization_practice_sessions
      WHERE user_id = target_user_id
    ),
    'spaced_repetition', (
      SELECT jsonb_build_object(
        'total_attempts', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END), 1), 0),
        'class_average', class_avg_sr,
        'compared_to_class', COALESCE(ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END), 1), 0) - class_avg_sr,
        'total_time_minutes', COALESCE(ROUND(SUM(response_time_ms) / 60000.0), 0),
        'recent_attempts', (
          SELECT jsonb_agg(
            jsonb_build_object(
              -- FIX: reference the subquery alias `recent.*` not inner aliases `sq.*` / `sra.*`
              'question_text', recent.question_text,
              'is_correct', recent.is_correct,
              'completed_at', recent.created_at,
              'response_time', recent.response_time_ms
            ) ORDER BY recent.created_at DESC
          )
          FROM (
            SELECT sq.question_text, sra.is_correct, sra.created_at, sra.response_time_ms
            FROM spaced_repetition_attempts sra
            JOIN spaced_repetition_questions sq ON sra.question_id = sq.id
            WHERE sra.user_id = target_user_id
            ORDER BY sra.created_at DESC
            LIMIT 10
          ) recent
        )
      )
      FROM spaced_repetition_attempts
      WHERE user_id = target_user_id
    )
  ) INTO result;

  RETURN result;
END;
$$;
