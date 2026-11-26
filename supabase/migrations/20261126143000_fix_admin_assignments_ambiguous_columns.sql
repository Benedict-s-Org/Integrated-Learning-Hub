-- Assignment Management list failed with:
--   column reference "assignment_type" is ambiguous
-- RETURNS TABLE output names are PL/pgSQL variables, so the outer
-- WHERE/ORDER BY must qualify every column from the CTE.

CREATE OR REPLACE FUNCTION public.get_all_assignments_admin_view(
  filter_type text DEFAULT NULL,
  filter_status text DEFAULT NULL,
  filter_student_id uuid DEFAULT NULL,
  sort_by text DEFAULT 'assigned_at',
  sort_order text DEFAULT 'desc'
)
RETURNS TABLE (
  assignment_id uuid,
  assignment_type text,
  student_id uuid,
  student_username text,
  student_display_name text,
  title text,
  assigned_at timestamptz,
  assigned_by_username text,
  due_date timestamptz,
  completed boolean,
  completed_at timestamptz,
  is_overdue boolean,
  assignment_level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH all_assignments AS (
    SELECT
      ma.id AS assignment_id,
      'memorization'::text AS assignment_type,
      ma.user_id AS student_id,
      u.username AS student_username,
      COALESCE(u.display_name, u.username) AS student_display_name,
      sc.title AS title,
      ma.assigned_at,
      au.username AS assigned_by_username,
      ma.due_date,
      ma.completed,
      ma.completed_at,
      (ma.completed = false AND ma.due_date < now()) AS is_overdue,
      NULL::integer AS assignment_level
    FROM memorization_assignments ma
    JOIN users u ON ma.user_id = u.id
    JOIN saved_contents sc ON ma.content_id = sc.id
    LEFT JOIN users au ON ma.assigned_by = au.id

    UNION ALL

    SELECT
      pa.id AS assignment_id,
      'spelling'::text AS assignment_type,
      pa.user_id AS student_id,
      u.username AS student_username,
      COALESCE(u.display_name, u.username) AS student_display_name,
      sp.title AS title,
      pa.assigned_at,
      au.username AS assigned_by_username,
      pa.due_date,
      COALESCE(pa.completed, false) AS completed,
      pa.completed_at,
      (COALESCE(pa.completed, false) = false AND pa.due_date < now()) AS is_overdue,
      pa.level AS assignment_level
    FROM practice_assignments pa
    JOIN users u ON pa.user_id = u.id
    JOIN spelling_practices sp ON pa.practice_id = sp.id
    LEFT JOIN users au ON pa.assigned_by = au.id

    UNION ALL

    SELECT
      ppa.id AS assignment_id,
      'proofreading'::text AS assignment_type,
      ppa.user_id AS student_id,
      u.username AS student_username,
      COALESCE(u.display_name, u.username) AS student_display_name,
      pp.title AS title,
      ppa.assigned_at,
      au.username AS assigned_by_username,
      ppa.due_date,
      ppa.completed,
      ppa.completed_at,
      (ppa.completed = false AND ppa.due_date < now()) AS is_overdue,
      NULL::integer AS assignment_level
    FROM proofreading_practice_assignments ppa
    JOIN users u ON ppa.user_id = u.id
    JOIN proofreading_practices pp ON ppa.practice_id = pp.id
    LEFT JOIN users au ON ppa.assigned_by = au.id

    UNION ALL

    SELECT
      sa.id AS assignment_id,
      'spaced_repetition'::text AS assignment_type,
      sa.user_id AS student_id,
      u.username AS student_username,
      COALESCE(u.display_name, u.username) AS student_display_name,
      srs.title AS title,
      sa.assigned_at,
      au.username AS assigned_by_username,
      sa.due_date,
      false AS completed,
      NULL::timestamptz AS completed_at,
      (sa.due_date IS NOT NULL AND sa.due_date < now()) AS is_overdue,
      NULL::integer AS assignment_level
    FROM set_assignments sa
    JOIN users u ON sa.user_id = u.id
    JOIN spaced_repetition_sets srs ON sa.set_id = srs.id
    LEFT JOIN users au ON sa.assigned_by = au.id
  )
  SELECT
    aa.assignment_id,
    aa.assignment_type,
    aa.student_id,
    aa.student_username,
    aa.student_display_name,
    aa.title,
    aa.assigned_at,
    aa.assigned_by_username,
    aa.due_date,
    aa.completed,
    aa.completed_at,
    aa.is_overdue,
    aa.assignment_level
  FROM all_assignments aa
  WHERE
    (filter_type IS NULL OR aa.assignment_type = filter_type)
    AND (
      filter_status IS NULL OR
      (filter_status = 'completed' AND aa.completed = true) OR
      (filter_status = 'in_progress' AND aa.completed = false AND (aa.due_date IS NULL OR aa.due_date >= now())) OR
      (filter_status = 'overdue' AND aa.completed = false AND aa.due_date < now())
    )
    AND (filter_student_id IS NULL OR aa.student_id = filter_student_id)
  ORDER BY
    CASE WHEN sort_by = 'assigned_at' AND sort_order = 'asc' THEN aa.assigned_at END ASC,
    CASE WHEN sort_by = 'assigned_at' AND sort_order = 'desc' THEN aa.assigned_at END DESC,
    CASE WHEN sort_by = 'due_date' AND sort_order = 'asc' THEN aa.due_date END ASC NULLS LAST,
    CASE WHEN sort_by = 'due_date' AND sort_order = 'desc' THEN aa.due_date END DESC NULLS LAST,
    CASE WHEN sort_by = 'student_name' AND sort_order = 'asc' THEN aa.student_display_name END ASC,
    CASE WHEN sort_by = 'student_name' AND sort_order = 'desc' THEN aa.student_display_name END DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_assignments_admin_view(text, text, uuid, text, text) TO authenticated, service_role;
