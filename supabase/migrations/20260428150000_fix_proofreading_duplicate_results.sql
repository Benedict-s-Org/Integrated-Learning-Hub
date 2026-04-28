-- Migration: Fix Duplicate Cards in Proofreading Assignments
-- Path: supabase/migrations/20260428150000_fix_proofreading_duplicate_results.sql

-- Update get_user_assigned_proofreading_practices to use a LATERAL JOIN
-- to get only the latest result for each assignment. This prevents duplicate 
-- cards if a student does a practice multiple times and ensures the latest 
-- score is displayed.

CREATE OR REPLACE FUNCTION get_user_assigned_proofreading_practices(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  practice_id uuid,
  title text,
  sentences jsonb,
  answers jsonb,
  assigned_at timestamptz,
  due_date timestamptz,
  completed boolean,
  completed_at timestamptz,
  assigned_by_username text,
  result_id uuid,
  accuracy_percentage numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    pa.id,
    pp.id AS practice_id,
    pp.title,
    pp.sentences,
    pp.answers,
    pa.assigned_at,
    pa.due_date,
    pa.completed,
    pa.completed_at,
    u.username AS assigned_by_username,
    pr.result_id,
    pr.accuracy_percentage
  FROM proofreading_practice_assignments pa
  JOIN proofreading_practices pp ON pa.practice_id = pp.id
  JOIN users u ON pa.assigned_by = u.id
  LEFT JOIN LATERAL (
    -- Get only the most recent result for this assignment
    SELECT res.id AS result_id, res.accuracy_percentage
    FROM proofreading_practice_results res
    WHERE res.assignment_id = pa.id
    ORDER BY res.completed_at DESC
    LIMIT 1
  ) pr ON true
  WHERE pa.user_id = target_user_id
  ORDER BY
    CASE WHEN pa.completed THEN 1 ELSE 0 END,
    pa.due_date NULLS LAST,
    pa.assigned_at DESC;
$$;
