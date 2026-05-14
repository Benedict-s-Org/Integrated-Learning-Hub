-- Fix missing get_performance_distribution function and add Spaced Repetition support
-- Path: supabase/migrations/20260505120000_fix_get_performance_distribution.sql

DROP FUNCTION IF EXISTS public.get_performance_distribution(text);

CREATE OR REPLACE FUNCTION public.get_performance_distribution(practice_type text DEFAULT 'spelling')
RETURNS TABLE (
  score_range text,
  student_count bigint,
  percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  total_students bigint;
BEGIN
  IF practice_type = 'spelling' THEN
    SELECT COUNT(DISTINCT user_id) INTO total_students FROM public.spelling_practice_results;

    RETURN QUERY
    WITH student_averages AS (
      SELECT
        user_id,
        ROUND(AVG(accuracy_percentage)) AS avg_score
      FROM public.spelling_practice_results
      GROUP BY user_id
    )
    SELECT
      r.score_range,
      COALESCE(s.count, 0) as student_count,
      ROUND((COALESCE(s.count, 0)::numeric / NULLIF(total_students, 0)) * 100, 1) AS percentage
    FROM (
      SELECT '90-100' AS score_range, 1 as sort_order
      UNION ALL SELECT '80-89', 2
      UNION ALL SELECT '70-79', 3
      UNION ALL SELECT '60-69', 4
      UNION ALL SELECT '0-59', 5
    ) r
    LEFT JOIN (
      SELECT 
        CASE 
          WHEN avg_score >= 90 THEN '90-100'
          WHEN avg_score >= 80 THEN '80-89'
          WHEN avg_score >= 70 THEN '70-79'
          WHEN avg_score >= 60 THEN '60-69'
          ELSE '0-59'
        END as range_label,
        COUNT(*) as count
      FROM student_averages
      GROUP BY 1
    ) s ON r.score_range = s.range_label
    ORDER BY r.sort_order;

  ELSIF practice_type = 'proofreading' THEN
    SELECT COUNT(DISTINCT user_id) INTO total_students FROM public.proofreading_practice_results;

    RETURN QUERY
    WITH student_averages AS (
      SELECT
        user_id,
        ROUND(AVG(accuracy_percentage)) AS avg_score
      FROM public.proofreading_practice_results
      GROUP BY user_id
    )
    SELECT
      r.score_range,
      COALESCE(s.count, 0) as student_count,
      ROUND((COALESCE(s.count, 0)::numeric / NULLIF(total_students, 0)) * 100, 1) AS percentage
    FROM (
      SELECT '90-100' AS score_range, 1 as sort_order
      UNION ALL SELECT '80-89', 2
      UNION ALL SELECT '70-79', 3
      UNION ALL SELECT '60-69', 4
      UNION ALL SELECT '0-59', 5
    ) r
    LEFT JOIN (
      SELECT 
        CASE 
          WHEN avg_score >= 90 THEN '90-100'
          WHEN avg_score >= 80 THEN '80-89'
          WHEN avg_score >= 70 THEN '70-79'
          WHEN avg_score >= 60 THEN '60-69'
          ELSE '0-59'
        END as range_label,
        COUNT(*) as count
      FROM student_averages
      GROUP BY 1
    ) s ON r.score_range = s.range_label
    ORDER BY r.sort_order;

  ELSIF practice_type = 'spaced_repetition' THEN
    SELECT COUNT(DISTINCT user_id) INTO total_students FROM public.spaced_repetition_attempts;

    RETURN QUERY
    WITH student_averages AS (
      SELECT
        user_id,
        ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END)) AS avg_score
      FROM public.spaced_repetition_attempts
      GROUP BY user_id
    )
    SELECT
      r.score_range,
      COALESCE(s.count, 0) as student_count,
      ROUND((COALESCE(s.count, 0)::numeric / NULLIF(total_students, 0)) * 100, 1) AS percentage
    FROM (
      SELECT '90-100' AS score_range, 1 as sort_order
      UNION ALL SELECT '80-89', 2
      UNION ALL SELECT '70-79', 3
      UNION ALL SELECT '60-69', 4
      UNION ALL SELECT '0-59', 5
    ) r
    LEFT JOIN (
      SELECT 
        CASE 
          WHEN avg_score >= 90 THEN '90-100'
          WHEN avg_score >= 80 THEN '80-89'
          WHEN avg_score >= 70 THEN '70-79'
          WHEN avg_score >= 60 THEN '60-69'
          ELSE '0-59'
        END as range_label,
        COUNT(*) as count
      FROM student_averages
      GROUP BY 1
    ) s ON r.score_range = s.range_label
    ORDER BY r.sort_order;

  ELSE
    -- Return empty set for unsupported types instead of erroring
    RETURN QUERY SELECT 'No Data'::text, 0::bigint, 0::numeric WHERE FALSE;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_performance_distribution(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_performance_distribution(text) TO service_role;
