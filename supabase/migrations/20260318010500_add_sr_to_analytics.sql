-- Add Spaced Repetition metrics to analytics functions

-- 1. Update get_class_analytics_summary to include SR
-- We drop and recreate to ensure return SETOF jsonb is consistent
DROP FUNCTION IF EXISTS get_class_analytics_summary(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION get_class_analytics_summary(date_from timestamptz DEFAULT NULL, date_to timestamptz DEFAULT NULL)
RETURNS SETOF jsonb 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH classes AS (
    SELECT DISTINCT COALESCE(class, 'Unassigned') as class_name
    FROM users
    WHERE role = 'user'
  ),
  spelling_stats AS (
    SELECT 
      COALESCE(u.class, 'Unassigned') as class_name,
      COUNT(*) as total_practices,
      ROUND(AVG(accuracy_percentage), 1) as average_accuracy,
      ROUND(SUM(time_spent_seconds) / 60.0, 1) as total_time_minutes
    FROM spelling_practice_results spr
    JOIN users u ON spr.user_id = u.id
    WHERE (date_from IS NULL OR completed_at >= date_from)
      AND (date_to IS NULL OR completed_at <= date_to)
    GROUP BY COALESCE(u.class, 'Unassigned')
  ),
  proofreading_stats AS (
    SELECT 
      COALESCE(u.class, 'Unassigned') as class_name,
      COUNT(*) as total_practices,
      ROUND(AVG(accuracy_percentage), 1) as average_accuracy,
      ROUND(SUM(time_spent_seconds) / 60.0, 1) as total_time_minutes
    FROM proofreading_practice_results ppr
    JOIN users u ON ppr.user_id = u.id
    WHERE (date_from IS NULL OR completed_at >= date_from)
      AND (date_to IS NULL OR completed_at <= date_to)
    GROUP BY COALESCE(u.class, 'Unassigned')
  ),
  memorization_stats AS (
    SELECT 
      COALESCE(u.class, 'Unassigned') as class_name,
      COUNT(*) as total_sessions,
      ROUND(SUM(session_duration_seconds) / 60.0, 1) as total_time_minutes
    FROM memorization_practice_sessions mps
    JOIN users u ON mps.user_id = u.id
    WHERE (date_from IS NULL OR completed_at >= date_from)
      AND (date_to IS NULL OR completed_at <= date_to)
    GROUP BY COALESCE(u.class, 'Unassigned')
  ),
  sr_stats AS (
    SELECT 
      COALESCE(u.class, 'Unassigned') as class_name,
      COUNT(*) as total_attempts,
      ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END), 1) as average_accuracy,
      ROUND(SUM(response_time_ms) / 60000.0, 1) as total_time_minutes
    FROM spaced_repetition_attempts sra
    JOIN users u ON sra.user_id = u.id
    WHERE (date_from IS NULL OR created_at >= date_from)
      AND (date_to IS NULL OR created_at <= date_to)
    GROUP BY COALESCE(u.class, 'Unassigned')
  )
  SELECT 
    jsonb_build_object(
      'class_name', c.class_name,
      'spelling', jsonb_build_object(
        'total_practices', COALESCE(s.total_practices, 0),
        'average_accuracy', COALESCE(s.average_accuracy, 0),
        'total_time_minutes', COALESCE(s.total_time_minutes, 0)
      ),
      'proofreading', jsonb_build_object(
        'total_practices', COALESCE(p.total_practices, 0),
        'average_accuracy', COALESCE(p.average_accuracy, 0),
        'total_time_minutes', COALESCE(p.total_time_minutes, 0)
      ),
      'memorization', jsonb_build_object(
        'total_sessions', COALESCE(m.total_sessions, 0),
        'total_time_minutes', COALESCE(m.total_time_minutes, 0)
      ),
      'spaced_repetition', jsonb_build_object(
        'total_attempts', COALESCE(sr.total_attempts, 0),
        'average_accuracy', COALESCE(sr.average_accuracy, 0),
        'total_time_minutes', COALESCE(sr.total_time_minutes, 0)
      )
    )
  FROM classes c
  LEFT JOIN spelling_stats s ON c.class_name = s.class_name
  LEFT JOIN proofreading_stats p ON c.class_name = p.class_name
  LEFT JOIN memorization_stats m ON c.class_name = m.class_name
  LEFT JOIN sr_stats sr ON c.class_name = sr.class_name;
END;
$$;

-- 2. Update get_all_students_performance to include SR and class info
DROP FUNCTION IF EXISTS get_all_students_performance(text);

CREATE OR REPLACE FUNCTION get_all_students_performance(p_class_name text DEFAULT NULL)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  class text,
  class_number int,
  spelling_practices bigint,
  spelling_avg_accuracy numeric,
  proofreading_practices bigint,
  proofreading_avg_accuracy numeric,
  memorization_sessions bigint,
  sr_attempts bigint,
  sr_avg_accuracy numeric,
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
    u.class,
    u.class_number,
    COALESCE(spelling_stats.practice_count, 0) AS spelling_practices,
    COALESCE(spelling_stats.avg_accuracy, 0) AS spelling_avg_accuracy,
    COALESCE(proofreading_stats.practice_count, 0) AS proofreading_practices,
    COALESCE(proofreading_stats.avg_accuracy, 0) AS proofreading_avg_accuracy,
    COALESCE(memorization_stats.session_count, 0) AS memorization_sessions,
    COALESCE(sr_stats.attempt_count, 0) AS sr_attempts,
    COALESCE(sr_stats.avg_accuracy, 0) AS sr_avg_accuracy,
    COALESCE(spelling_stats.practice_count, 0) + 
      COALESCE(proofreading_stats.practice_count, 0) + 
      COALESCE(memorization_stats.session_count, 0) + 
      COALESCE(sr_stats.attempt_count, 0) AS total_practices,
    COALESCE(
      ROUND(
        (COALESCE(spelling_stats.avg_accuracy, 0) * COALESCE(spelling_stats.practice_count, 0) +
         COALESCE(proofreading_stats.avg_accuracy, 0) * COALESCE(proofreading_stats.practice_count, 0) +
         COALESCE(sr_stats.avg_accuracy, 0) * COALESCE(sr_stats.attempt_count, 0)) /
        NULLIF(COALESCE(spelling_stats.practice_count, 0) + 
               COALESCE(proofreading_stats.practice_count, 0) + 
               COALESCE(sr_stats.attempt_count, 0), 0),
        1
      ),
      0
    ) AS overall_avg_accuracy,
    GREATEST(
      spelling_stats.last_practice,
      proofreading_stats.last_practice,
      memorization_stats.last_session,
      sr_stats.last_attempt
    ) AS last_activity,
    COALESCE(spelling_stats.total_time, 0) + 
      COALESCE(proofreading_stats.total_time, 0) + 
      COALESCE(memorization_stats.total_time, 0) + 
      COALESCE(sr_stats.total_time, 0) AS total_time_minutes
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
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS attempt_count,
      ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END), 1) AS avg_accuracy,
      MAX(created_at) AS last_attempt,
      ROUND(SUM(response_time_ms) / 60000.0) AS total_time
    FROM spaced_repetition_attempts
    GROUP BY user_id
  ) AS sr_stats ON u.id = sr_stats.user_id
  WHERE u.role = 'user'
    AND (p_class_name IS NULL OR u.class = p_class_name)
  ORDER BY total_practices DESC, overall_avg_accuracy DESC;
$$;
