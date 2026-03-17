-- Fix ambiguous column reference in get_class_analytics_summary

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
    WHERE (date_from IS NULL OR sra.created_at >= date_from)
      AND (date_to IS NULL OR sra.created_at <= date_to)
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
