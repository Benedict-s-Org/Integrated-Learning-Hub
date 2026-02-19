-- Ensure base tracking tables exist
CREATE TABLE IF NOT EXISTS public.spelling_practice_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  practice_id uuid,
  title text NOT NULL,
  words text[] NOT NULL,
  user_answers jsonb NOT NULL,
  correct_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  accuracy_percentage integer NOT NULL DEFAULT 0,
  practice_level integer NOT NULL DEFAULT 1,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proofreading_practice_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sentences text[] NOT NULL,
  correct_answers jsonb NOT NULL,
  user_answers jsonb NOT NULL,
  correct_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  accuracy_percentage integer NOT NULL DEFAULT 0,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memorization_practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_id uuid,
  title text NOT NULL,
  original_text text NOT NULL,
  total_words integer NOT NULL DEFAULT 0,
  hidden_words_count integer NOT NULL DEFAULT 0,
  session_duration_seconds integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS (safe even if already enabled)
ALTER TABLE public.spelling_practice_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proofreading_practice_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memorization_practice_sessions ENABLE ROW LEVEL SECURITY;

-- Add basic policies if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'spelling_practice_results' AND policyname = 'Users can view own spelling results') THEN
    CREATE POLICY "Users can view own spelling results" ON public.spelling_practice_results FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'spelling_practice_results' AND policyname = 'Users can insert own spelling results') THEN
    CREATE POLICY "Users can insert own spelling results" ON public.spelling_practice_results FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'proofreading_practice_results' AND policyname = 'Users can view own proofreading results') THEN
    CREATE POLICY "Users can view own proofreading results" ON public.proofreading_practice_results FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'proofreading_practice_results' AND policyname = 'Users can insert own proofreading results') THEN
    CREATE POLICY "Users can insert own proofreading results" ON public.proofreading_practice_results FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memorization_practice_sessions' AND policyname = 'Users can view own memorization sessions') THEN
    CREATE POLICY "Users can view own memorization sessions" ON public.memorization_practice_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'memorization_practice_sessions' AND policyname = 'Users can insert own memorization sessions') THEN
    CREATE POLICY "Users can insert own memorization sessions" ON public.memorization_practice_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Update get_class_analytics_summary to include spaced repetition
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
        'total_practices', COUNT(*),
        'unique_students', COUNT(DISTINCT user_id),
        'average_accuracy', COALESCE(ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END), 1), 0),
        'total_time_hours', COALESCE(ROUND(SUM(response_time_ms) / 3600000.0, 1), 0),
        'avg_time_minutes', COALESCE(ROUND(AVG(response_time_ms) / 60000.0, 1), 0)
      )
      FROM spaced_repetition_attempts
      WHERE (date_from IS NULL OR created_at >= date_from)
        AND (date_to IS NULL OR created_at <= date_to)
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Update get_all_students_performance to include spaced repetition
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
  spaced_repetition_sessions bigint,
  total_practices bigint,
  overall_avg_accuracy numeric,
  last_activity timestamptz,
  total_time_minutes bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH spelling_stats AS (
    SELECT
      user_id,
      COUNT(*) AS practice_count,
      ROUND(AVG(accuracy_percentage), 1) AS avg_accuracy,
      MAX(completed_at) AS last_practice,
      ROUND(SUM(time_spent_seconds) / 60.0)::bigint AS total_time
    FROM public.spelling_practice_results
    GROUP BY user_id
  ),
  proofreading_stats AS (
    SELECT
      user_id,
      COUNT(*) AS practice_count,
      ROUND(AVG(accuracy_percentage), 1) AS avg_accuracy,
      MAX(completed_at) AS last_practice,
      ROUND(SUM(time_spent_seconds) / 60.0)::bigint AS total_time
    FROM public.proofreading_practice_results
    GROUP BY user_id
  ),
  memorization_stats AS (
    SELECT
      user_id,
      COUNT(*) AS session_count,
      MAX(completed_at) AS last_session,
      ROUND(SUM(session_duration_seconds) / 60.0)::bigint AS total_time
    FROM public.memorization_practice_sessions
    GROUP BY user_id
  ),
  sr_stats AS (
    SELECT
      user_id,
      COUNT(*) AS attempt_count,
      ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END), 1) AS avg_accuracy,
      MAX(created_at) AS last_attempt,
      ROUND(SUM(response_time_ms) / 60000.0)::bigint AS total_time
    FROM public.spaced_repetition_attempts
    GROUP BY user_id
  )
  SELECT
    u.id AS user_id,
    u.username,
    COALESCE(u.display_name, u.username) AS display_name,
    COALESCE(s.practice_count, 0)::bigint AS spelling_practices,
    COALESCE(s.avg_accuracy, 0.0)::numeric AS spelling_avg_accuracy,
    COALESCE(p.practice_count, 0)::bigint AS proofreading_practices,
    COALESCE(p.avg_accuracy, 0.0)::numeric AS proofreading_avg_accuracy,
    COALESCE(m.session_count, 0)::bigint AS memorization_sessions,
    COALESCE(sr.attempt_count, 0)::bigint AS spaced_repetition_sessions,
    (COALESCE(s.practice_count, 0) + COALESCE(p.practice_count, 0) + COALESCE(m.session_count, 0) + COALESCE(sr.attempt_count, 0))::bigint AS total_practices,
    COALESCE(
      ROUND(
        (COALESCE(s.avg_accuracy, 0) * COALESCE(s.practice_count, 0) +
         COALESCE(p.avg_accuracy, 0) * COALESCE(p.practice_count, 0) +
         COALESCE(sr.avg_accuracy, 0) * COALESCE(sr.attempt_count, 0)) /
        NULLIF(COALESCE(s.practice_count, 0) + COALESCE(p.practice_count, 0) + COALESCE(sr.attempt_count, 0), 0),
        1
      ),
      0.0
    )::numeric AS overall_avg_accuracy,
    GREATEST(
      s.last_practice,
      p.last_practice,
      m.last_session,
      sr.last_attempt
    ) AS last_activity,
    (COALESCE(s.total_time, 0) + COALESCE(p.total_time, 0) + COALESCE(m.total_time, 0) + COALESCE(sr.total_time, 0))::bigint AS total_time_minutes
  FROM public.users u
  LEFT JOIN spelling_stats s ON u.id = s.user_id
  LEFT JOIN proofreading_stats p ON u.id = p.user_id
  LEFT JOIN memorization_stats m ON u.id = m.user_id
  LEFT JOIN sr_stats sr ON u.id = sr.user_id
  WHERE u.role = 'user'
  ORDER BY total_practices DESC, overall_avg_accuracy DESC;
$$;

-- Update get_recent_activity to include spaced repetition
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
  )
  SELECT *
  FROM all_activities
  ORDER BY completed_at DESC
  LIMIT limit_count;
$$;

-- Update get_practice_activity_timeline to include spaced repetition
CREATE OR REPLACE FUNCTION get_practice_activity_timeline(days_back int DEFAULT 30)
RETURNS TABLE (
  activity_date date,
  spelling_count bigint,
  proofreading_count bigint,
  memorization_count bigint,
  spaced_repetition_count bigint,
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
    COALESCE(sr.count, 0) AS spaced_repetition_count,
    COALESCE(spelling.count, 0) + COALESCE(proofreading.count, 0) + COALESCE(memorization.count, 0) + COALESCE(sr.count, 0) AS total_count,
    COALESCE(
      GREATEST(
        COALESCE(spelling.unique_users, 0),
        COALESCE(proofreading.unique_users, 0),
        COALESCE(memorization.unique_users, 0),
        COALESCE(sr.unique_users, 0)
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
  LEFT JOIN (
    SELECT
      created_at::date AS activity_date,
      COUNT(*) AS count,
      COUNT(DISTINCT user_id) AS unique_users
    FROM spaced_repetition_attempts
    WHERE created_at >= CURRENT_DATE - days_back * INTERVAL '1 day'
    GROUP BY created_at::date
  ) sr ON ds.activity_date = sr.activity_date
  ORDER BY ds.activity_date;
$$;

-- Add spaced repetition section to get_student_detailed_analytics
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
              'question_text', sq.question_text,
              'is_correct', sra.is_correct,
              'completed_at', sra.created_at,
              'response_time', sra.response_time_ms
            ) ORDER BY sra.created_at DESC
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
