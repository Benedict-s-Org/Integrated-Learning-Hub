-- Fix Proofreading RPC Join
-- Change JOIN to LEFT JOIN for users table to ensure assignments load even if admin record is missing in public.users
-- Created: 2026-02-04 00:00:02

CREATE OR REPLACE FUNCTION public.get_user_assigned_proofreading_practices(target_user_id uuid)
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
SET search_path = public, pg_temp
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
    COALESCE(u.username, 'System') AS assigned_by_username,
    pr.id AS result_id,
    pr.accuracy_percentage
  FROM proofreading_practice_assignments pa
  JOIN proofreading_practices pp ON pa.practice_id = pp.id
  LEFT JOIN users u ON pa.assigned_by = u.id
  LEFT JOIN proofreading_practice_results pr ON pr.assignment_id = pa.id
  WHERE pa.user_id = target_user_id
  ORDER BY
    CASE WHEN pa.completed THEN 1 ELSE 0 END,
    pa.due_date NULLS LAST,
    pa.assigned_at DESC;
$$;

-- Grant execution permissions just in case
GRANT EXECUTE ON FUNCTION public.get_user_assigned_proofreading_practices(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_assigned_proofreading_practices(uuid) TO service_role;
