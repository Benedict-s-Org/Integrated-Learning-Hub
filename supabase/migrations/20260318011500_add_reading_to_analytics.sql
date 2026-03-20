-- Add Reading Practice metrics to analytics functions

-- 1. Update get_class_analytics_summary to include Reading
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
    WHERE (date_from IS NULL OR spr.completed_at >= date_from)
      AND (date_to IS NULL OR spr.completed_at <= date_to)
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
    WHERE (date_from IS NULL OR ppr.completed_at >= date_from)
      AND (date_to IS NULL OR ppr.completed_at <= date_to)
    GROUP BY COALESCE(u.class, 'Unassigned')
  ),
  memorization_stats AS (
    SELECT 
      COALESCE(u.class, 'Unassigned') as class_name,
      COUNT(*) as total_sessions,
      ROUND(SUM(session_duration_seconds) / 60.0, 1) as total_time_minutes
    FROM memorization_practice_sessions mps
    JOIN users u ON mps.user_id = u.id
    WHERE (date_from IS NULL OR mps.completed_at >= date_from)
      AND (date_to IS NULL OR mps.completed_at <= date_to)
    GROUP BY COALESCE(u.class, 'Unassigned')
  ),
  sr_stats AS (
    SELECT 
      COALESCE(u.class, 'Unassigned') as class_name,
      COUNT(*) as total_attempts,
      ROUND(AVG(CASE WHEN sra.is_correct THEN 100 ELSE 0 END), 1) as average_accuracy,
      ROUND(SUM(sra.response_time_ms) / 60000.0, 1) as total_time_minutes
    FROM spaced_repetition_attempts sra
    JOIN users u ON sra.user_id = u.id
    WHERE (date_from IS NULL OR sra.created_at >= date_from)
      AND (date_to IS NULL OR sra.created_at <= date_to)
    GROUP BY COALESCE(u.class, 'Unassigned')
  ),
  reading_stats AS (
    SELECT 
      COALESCE(u.class, 'Unassigned') as class_name,
      COUNT(*) as total_responses,
      COUNT(*) FILTER (WHERE rsr.answer_status = 'perfect') as perfect_responses,
      ROUND(AVG(CASE WHEN rsr.answer_status = 'perfect' THEN 100 ELSE 0 END), 1) as average_accuracy
    FROM reading_student_responses rsr
    JOIN users u ON rsr.student_id = u.id
    WHERE (date_from IS NULL OR rsr.created_at >= date_from)
      AND (date_to IS NULL OR rsr.created_at <= date_to)
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
      ),
      'reading', jsonb_build_object(
        'total_responses', COALESCE(r.total_responses, 0),
        'perfect_responses', COALESCE(r.perfect_responses, 0),
        'average_accuracy', COALESCE(r.average_accuracy, 0)
      )
    )
  FROM classes c
  LEFT JOIN spelling_stats s ON c.class_name = s.class_name
  LEFT JOIN proofreading_stats p ON c.class_name = p.class_name
  LEFT JOIN memorization_stats m ON c.class_name = m.class_name
  LEFT JOIN sr_stats sr ON c.class_name = sr.class_name
  LEFT JOIN reading_stats r ON c.class_name = r.class_name;
END;
$$;

-- 2. Update get_all_students_performance to include Reading
DROP FUNCTION IF EXISTS get_all_students_performance();
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
  reading_attempts bigint,
  reading_perfect_count bigint,
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
    COALESCE(reading_stats.response_count, 0) AS reading_attempts,
    COALESCE(reading_stats.perfect_count, 0) AS reading_perfect_count,
    COALESCE(spelling_stats.practice_count, 0) + 
      COALESCE(proofreading_stats.practice_count, 0) + 
      COALESCE(memorization_stats.session_count, 0) + 
      COALESCE(sr_stats.attempt_count, 0) +
      COALESCE(reading_stats.response_count, 0) AS total_practices,
    COALESCE(
      ROUND(
        (COALESCE(spelling_stats.avg_accuracy, 0) * COALESCE(spelling_stats.practice_count, 0) +
         COALESCE(proofreading_stats.avg_accuracy, 0) * COALESCE(proofreading_stats.practice_count, 0) +
         COALESCE(sr_stats.avg_accuracy, 0) * COALESCE(sr_stats.attempt_count, 0) +
         COALESCE(reading_stats.avg_accuracy, 0) * COALESCE(reading_stats.response_count, 0)) /
        NULLIF(COALESCE(spelling_stats.practice_count, 0) + 
               COALESCE(proofreading_stats.practice_count, 0) + 
               COALESCE(sr_stats.attempt_count, 0) +
               COALESCE(reading_stats.response_count, 0), 0),
        1
      ),
      0
    ) AS overall_avg_accuracy,
    GREATEST(
      spelling_stats.last_practice,
      proofreading_stats.last_practice,
      memorization_stats.last_session,
      sr_stats.last_attempt,
      reading_stats.last_response
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
  LEFT JOIN (
    SELECT
      student_id,
      COUNT(*) AS response_count,
      COUNT(*) FILTER (WHERE answer_status = 'perfect') as perfect_count,
      ROUND(AVG(CASE WHEN answer_status = 'perfect' THEN 100 ELSE 0 END), 1) as avg_accuracy,
      MAX(created_at) AS last_response
    FROM reading_student_responses
    GROUP BY student_id
  ) AS reading_stats ON u.id = reading_stats.student_id
  WHERE u.role = 'user'
    AND (p_class_name IS NULL OR u.class = p_class_name)
  ORDER BY total_practices DESC, overall_avg_accuracy DESC;
$$;

-- 3. Update get_recent_activity to include Reading
DROP FUNCTION IF EXISTS get_recent_activity(integer);
CREATE OR REPLACE FUNCTION get_recent_activity(limit_count int DEFAULT 50)
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

    UNION ALL

    SELECT
      'spaced_repetition' AS activity_type,
      sra.user_id,
      u.username,
      COALESCE(u.display_name, u.username) AS display_name,
      'Review: ' || sq.question_text AS title,
      CASE WHEN sra.is_correct THEN 100 ELSE 0 END AS accuracy_percentage,
      sra.created_at AS completed_at
    FROM spaced_repetition_attempts sra
    JOIN users u ON sra.user_id = u.id
    JOIN spaced_repetition_questions sq ON sra.question_id = sq.id

    UNION ALL

    SELECT
      'reading' AS activity_type,
      rsr.student_id as user_id,
      u.username,
      COALESCE(u.display_name, u.username) AS display_name,
      'Reading: ' || rq.interaction_type || ' (' || rsr.answer_status || ')' AS title,
      CASE WHEN rsr.answer_status = 'perfect' THEN 100 ELSE 0 END AS accuracy_percentage,
      rsr.created_at AS completed_at
    FROM reading_student_responses rsr
    JOIN users u ON rsr.student_id = u.id
    JOIN reading_questions rq ON rsr.question_id = rq.id
  )
  SELECT *
  FROM all_activities
  ORDER BY completed_at DESC
  LIMIT limit_count;
$$;
