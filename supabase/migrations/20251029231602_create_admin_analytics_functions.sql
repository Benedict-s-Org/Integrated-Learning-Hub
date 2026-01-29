/*
  # Create Administrator Analytics Functions

  1. New Functions
    - `get_class_analytics_summary()` - Returns comprehensive class-wide metrics across all practice types
    - `get_all_students_performance()` - Returns detailed performance data for all students
    - `get_student_detailed_analytics(target_user_id)` - Returns deep analytics for a specific student
    - `get_practice_activity_timeline(days_back)` - Returns time-series data of practice activity
    - `get_performance_distribution(practice_type)` - Returns distribution of scores across students
    - `get_recent_activity(limit_count)` - Returns recent activity across all students

  2. Security
    - All functions use SECURITY DEFINER to allow admin access
    - Functions are callable by authenticated users (admin check done in application layer)
    - Read-only operations to maintain data integrity

  3. Performance
    - Functions use efficient aggregations and joins
    - Results are optimized for dashboard rendering
    - Indexes created in previous migrations support these queries

  4. Important Notes
    - Functions return JSONB for flexible data structures
    - All percentages are rounded to 1 decimal place for readability
    - Time calculations are in minutes for consistency
    - NULL values are handled with COALESCE for clean results
*/

-- Function to get comprehensive class-wide analytics summary
CREATE OR REPLACE FUNCTION get_class_analytics_summary(date_from timestamptz DEFAULT NULL, date_to timestamptz DEFAULT NULL)
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
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get all students' performance overview
CREATE OR REPLACE FUNCTION get_all_students_performance()
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  spelling_practices bigint,
  spelling_avg_accuracy numeric,
  proofreading_practices bigint,
  proofreading_avg_accuracy numeric,
  memorization_sessions bigint,
  total_practices bigint,
  overall_avg_accuracy numeric,
  last_activity timestamptz,
  total_time_minutes bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    u.id AS user_id,
    u.username,
    COALESCE(u.display_name, u.username) AS display_name,
    COALESCE(spelling_stats.practice_count, 0) AS spelling_practices,
    COALESCE(spelling_stats.avg_accuracy, 0) AS spelling_avg_accuracy,
    COALESCE(proofreading_stats.practice_count, 0) AS proofreading_practices,
    COALESCE(proofreading_stats.avg_accuracy, 0) AS proofreading_avg_accuracy,
    COALESCE(memorization_stats.session_count, 0) AS memorization_sessions,
    COALESCE(spelling_stats.practice_count, 0) + COALESCE(proofreading_stats.practice_count, 0) + COALESCE(memorization_stats.session_count, 0) AS total_practices,
    COALESCE(
      ROUND(
        (COALESCE(spelling_stats.avg_accuracy, 0) * COALESCE(spelling_stats.practice_count, 0) +
         COALESCE(proofreading_stats.avg_accuracy, 0) * COALESCE(proofreading_stats.practice_count, 0)) /
        NULLIF(COALESCE(spelling_stats.practice_count, 0) + COALESCE(proofreading_stats.practice_count, 0), 0),
        1
      ),
      0
    ) AS overall_avg_accuracy,
    GREATEST(
      spelling_stats.last_practice,
      proofreading_stats.last_practice,
      memorization_stats.last_session
    ) AS last_activity,
    COALESCE(spelling_stats.total_time, 0) + COALESCE(proofreading_stats.total_time, 0) + COALESCE(memorization_stats.total_time, 0) AS total_time_minutes
  FROM users u
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS practice_count,
      ROUND(AVG(accuracy_percentage), 1) AS avg_accuracy,
      MAX(completed_at) AS last_practice,
      ROUND(SUM(time_spent_seconds) / 60.0) AS total_time
    FROM spelling_practice_results
    GROUP BY user_id
  ) AS spelling_stats ON u.id = spelling_stats.user_id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS practice_count,
      ROUND(AVG(accuracy_percentage), 1) AS avg_accuracy,
      MAX(completed_at) AS last_practice,
      ROUND(SUM(time_spent_seconds) / 60.0) AS total_time
    FROM proofreading_practice_results
    GROUP BY user_id
  ) AS proofreading_stats ON u.id = proofreading_stats.user_id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS session_count,
      MAX(completed_at) AS last_session,
      ROUND(SUM(session_duration_seconds) / 60.0) AS total_time
    FROM memorization_practice_sessions
    GROUP BY user_id
  ) AS memorization_stats ON u.id = memorization_stats.user_id
  WHERE u.role = 'user'
  ORDER BY total_practices DESC, overall_avg_accuracy DESC;
$$;

-- Function to get detailed analytics for a specific student
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
BEGIN
  -- Get class averages for comparison
  SELECT COALESCE(ROUND(AVG(accuracy_percentage), 1), 0) INTO class_avg_spelling
  FROM spelling_practice_results;

  SELECT COALESCE(ROUND(AVG(accuracy_percentage), 1), 0) INTO class_avg_proofreading
  FROM proofreading_practice_results;

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
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get practice activity timeline for visualization
CREATE OR REPLACE FUNCTION get_practice_activity_timeline(days_back int DEFAULT 30)
RETURNS TABLE (
  activity_date date,
  spelling_count bigint,
  proofreading_count bigint,
  memorization_count bigint,
  total_count bigint,
  unique_students bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - days_back * INTERVAL '1 day',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS activity_date
  )
  SELECT
    ds.activity_date,
    COALESCE(spelling.count, 0) AS spelling_count,
    COALESCE(proofreading.count, 0) AS proofreading_count,
    COALESCE(memorization.count, 0) AS memorization_count,
    COALESCE(spelling.count, 0) + COALESCE(proofreading.count, 0) + COALESCE(memorization.count, 0) AS total_count,
    COALESCE(
      GREATEST(
        COALESCE(spelling.unique_users, 0),
        COALESCE(proofreading.unique_users, 0),
        COALESCE(memorization.unique_users, 0)
      ),
      0
    ) AS unique_students
  FROM date_series ds
  LEFT JOIN (
    SELECT
      completed_at::date AS activity_date,
      COUNT(*) AS count,
      COUNT(DISTINCT user_id) AS unique_users
    FROM spelling_practice_results
    WHERE completed_at >= CURRENT_DATE - days_back * INTERVAL '1 day'
    GROUP BY completed_at::date
  ) spelling ON ds.activity_date = spelling.activity_date
  LEFT JOIN (
    SELECT
      completed_at::date AS activity_date,
      COUNT(*) AS count,
      COUNT(DISTINCT user_id) AS unique_users
    FROM proofreading_practice_results
    WHERE completed_at >= CURRENT_DATE - days_back * INTERVAL '1 day'
    GROUP BY completed_at::date
  ) proofreading ON ds.activity_date = proofreading.activity_date
  LEFT JOIN (
    SELECT
      completed_at::date AS activity_date,
      COUNT(*) AS count,
      COUNT(DISTINCT user_id) AS unique_users
    FROM memorization_practice_sessions
    WHERE completed_at >= CURRENT_DATE - days_back * INTERVAL '1 day'
    GROUP BY completed_at::date
  ) memorization ON ds.activity_date = memorization.activity_date
  ORDER BY ds.activity_date;
$$;

-- Function to get performance distribution for charts
CREATE OR REPLACE FUNCTION get_performance_distribution(practice_type text DEFAULT 'spelling')
RETURNS TABLE (
  score_range text,
  student_count bigint,
  percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  total_students bigint;
BEGIN
  IF practice_type = 'spelling' THEN
    SELECT COUNT(DISTINCT user_id) INTO total_students FROM spelling_practice_results;

    RETURN QUERY
    WITH student_averages AS (
      SELECT
        user_id,
        ROUND(AVG(accuracy_percentage)) AS avg_score
      FROM spelling_practice_results
      GROUP BY user_id
    )
    SELECT
      score_range,
      count,
      ROUND((count::numeric / NULLIF(total_students, 0)) * 100, 1) AS percentage
    FROM (
      SELECT '90-100' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 90
      UNION ALL
      SELECT '80-89' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 80 AND avg_score < 90
      UNION ALL
      SELECT '70-79' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 70 AND avg_score < 80
      UNION ALL
      SELECT '60-69' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 60 AND avg_score < 70
      UNION ALL
      SELECT '0-59' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score < 60
    ) ranges
    ORDER BY
      CASE score_range
        WHEN '90-100' THEN 1
        WHEN '80-89' THEN 2
        WHEN '70-79' THEN 3
        WHEN '60-69' THEN 4
        WHEN '0-59' THEN 5
      END;
  ELSIF practice_type = 'proofreading' THEN
    SELECT COUNT(DISTINCT user_id) INTO total_students FROM proofreading_practice_results;

    RETURN QUERY
    WITH student_averages AS (
      SELECT
        user_id,
        ROUND(AVG(accuracy_percentage)) AS avg_score
      FROM proofreading_practice_results
      GROUP BY user_id
    )
    SELECT
      score_range,
      count,
      ROUND((count::numeric / NULLIF(total_students, 0)) * 100, 1) AS percentage
    FROM (
      SELECT '90-100' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 90
      UNION ALL
      SELECT '80-89' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 80 AND avg_score < 90
      UNION ALL
      SELECT '70-79' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 70 AND avg_score < 80
      UNION ALL
      SELECT '60-69' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 60 AND avg_score < 70
      UNION ALL
      SELECT '0-59' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score < 60
    ) ranges
    ORDER BY
      CASE score_range
        WHEN '90-100' THEN 1
        WHEN '80-89' THEN 2
        WHEN '70-79' THEN 3
        WHEN '60-69' THEN 4
        WHEN '0-59' THEN 5
      END;
  END IF;
END;
$$;

-- Function to get recent activity across all students
CREATE OR REPLACE FUNCTION get_recent_activity(limit_count int DEFAULT 20)
RETURNS TABLE (
  activity_type text,
  user_id uuid,
  username text,
  display_name text,
  title text,
  accuracy_percentage int,
  completed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH all_activities AS (
    SELECT
      'spelling' AS activity_type,
      spr.user_id,
      u.username,
      COALESCE(u.display_name, u.username) AS display_name,
      spr.title,
      spr.accuracy_percentage,
      spr.completed_at
    FROM spelling_practice_results spr
    JOIN users u ON spr.user_id = u.id

    UNION ALL

    SELECT
      'proofreading' AS activity_type,
      ppr.user_id,
      u.username,
      COALESCE(u.display_name, u.username) AS display_name,
      array_length(ppr.sentences, 1)::text || ' sentences' AS title,
      ppr.accuracy_percentage,
      ppr.completed_at
    FROM proofreading_practice_results ppr
    JOIN users u ON ppr.user_id = u.id

    UNION ALL

    SELECT
      'memorization' AS activity_type,
      mps.user_id,
      u.username,
      COALESCE(u.display_name, u.username) AS display_name,
      mps.title,
      NULL AS accuracy_percentage,
      mps.completed_at
    FROM memorization_practice_sessions mps
    JOIN users u ON mps.user_id = u.id
  )
  SELECT *
  FROM all_activities
  ORDER BY completed_at DESC
  LIMIT limit_count;
$$;
