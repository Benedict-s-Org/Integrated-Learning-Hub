-- Migration: Update Admin Assignment View
-- Description: Adds level column to get_all_assignments_admin_view return type.

CREATE OR REPLACE FUNCTION get_all_assignments_admin_view(
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
) AS $$
BEGIN
  RETURN QUERY
  WITH all_assignments AS (
    -- Memorization assignments
    SELECT 
      ma.id as assignment_id,
      'memorization'::text as assignment_type,
      ma.user_id as student_id,
      u.username as student_username,
      COALESCE(u.display_name, u.username) as student_display_name,
      sc.title as title,
      ma.assigned_at,
      au.username as assigned_by_username,
      ma.due_date,
      ma.completed,
      ma.completed_at,
      (ma.completed = false AND ma.due_date < now()) as is_overdue,
      NULL::integer as assignment_level
    FROM memorization_assignments ma
    JOIN users u ON ma.user_id = u.id
    JOIN saved_contents sc ON ma.content_id = sc.id
    LEFT JOIN users au ON ma.assigned_by = au.id
    
    UNION ALL
    
    -- Spelling assignments
    SELECT 
      pa.id as assignment_id,
      'spelling'::text as assignment_type,
      pa.user_id as student_id,
      u.username as student_username,
      COALESCE(u.display_name, u.username) as student_display_name,
      sp.title as title,
      pa.assigned_at,
      au.username as assigned_by_username,
      pa.due_date,
      COALESCE(pa.completed, false) as completed,
      pa.completed_at,
      (COALESCE(pa.completed, false) = false AND pa.due_date < now()) as is_overdue,
      pa.level as assignment_level
    FROM practice_assignments pa
    JOIN users u ON pa.user_id = u.id
    JOIN spelling_practices sp ON pa.practice_id = sp.id
    LEFT JOIN users au ON pa.assigned_by = au.id
    
    UNION ALL
    
    -- Proofreading assignments
    SELECT 
      ppa.id as assignment_id,
      'proofreading'::text as assignment_type,
      ppa.user_id as student_id,
      u.username as student_username,
      COALESCE(u.display_name, u.username) as student_display_name,
      pp.title as title,
      ppa.assigned_at,
      au.username as assigned_by_username,
      ppa.due_date,
      ppa.completed,
      ppa.completed_at,
      (ppa.completed = false AND ppa.due_date < now()) as is_overdue,
      NULL::integer as assignment_level
    FROM proofreading_practice_assignments ppa
    JOIN users u ON ppa.user_id = u.id
    JOIN proofreading_practices pp ON ppa.practice_id = pp.id
    LEFT JOIN users au ON ppa.assigned_by = au.id
  )
  SELECT * FROM all_assignments
  WHERE 
    (filter_type IS NULL OR assignment_type = filter_type)
    AND (filter_status IS NULL OR 
      (filter_status = 'completed' AND completed = true) OR
      (filter_status = 'in_progress' AND completed = false AND (due_date IS NULL OR due_date >= now())) OR
      (filter_status = 'overdue' AND completed = false AND due_date < now()))
    AND (filter_student_id IS NULL OR student_id = filter_student_id)
  ORDER BY
    CASE WHEN sort_by = 'assigned_at' AND sort_order = 'asc' THEN assigned_at END ASC,
    CASE WHEN sort_by = 'assigned_at' AND sort_order = 'desc' THEN assigned_at END DESC,
    CASE WHEN sort_by = 'due_date' AND sort_order = 'asc' THEN due_date END ASC NULLS LAST,
    CASE WHEN sort_by = 'due_date' AND sort_order = 'desc' THEN due_date END DESC NULLS LAST,
    CASE WHEN sort_by = 'student_name' AND sort_order = 'asc' THEN student_display_name END ASC,
    CASE WHEN sort_by = 'student_name' AND sort_order = 'desc' THEN student_display_name END DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
