/*
  # Create Comprehensive Assignment View Functions

  This migration creates database functions to provide unified views of all assignment types
  across the system (memorization, spelling, proofreading).

  Functions created:
  1. get_all_assignments_overview() - Get overview statistics for all assignments
  2. get_all_assignments_admin_view() - Get detailed list of all assignments for admin
  3. get_student_assignments_unified() - Get all assignments for a specific student
  4. get_overdue_assignments() - Get all overdue assignments
  5. get_assignment_completion_stats_by_type() - Get completion statistics by assignment type
  6. mark_spelling_assignment_complete() - Mark a spelling assignment as complete

  These functions provide comprehensive assignment tracking across all three types.
*/

-- Function 1: Get overview statistics for all assignments
CREATE OR REPLACE FUNCTION get_all_assignments_overview()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'memorization', (
      SELECT json_build_object(
        'total', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE completed = true),
        'in_progress', COUNT(*) FILTER (WHERE completed = false),
        'overdue', COUNT(*) FILTER (WHERE completed = false AND due_date < now()),
        'completion_rate', CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE completed = true)::numeric / COUNT(*)::numeric) * 100, 1)
          ELSE 0
        END
      )
      FROM memorization_assignments
    ),
    'spelling', (
      SELECT json_build_object(
        'total', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE completed = true),
        'in_progress', COUNT(*) FILTER (WHERE completed = false),
        'overdue', COUNT(*) FILTER (WHERE completed = false AND due_date < now()),
        'completion_rate', CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE completed = true)::numeric / COUNT(*)::numeric) * 100, 1)
          ELSE 0
        END
      )
      FROM practice_assignments
    ),
    'proofreading', (
      SELECT json_build_object(
        'total', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE completed = true),
        'in_progress', COUNT(*) FILTER (WHERE completed = false),
        'overdue', COUNT(*) FILTER (WHERE completed = false AND due_date < now()),
        'completion_rate', CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE completed = true)::numeric / COUNT(*)::numeric) * 100, 1)
          ELSE 0
        END
      )
      FROM proofreading_practice_assignments
    ),
    'total_across_all_types', (
      SELECT json_build_object(
        'total', (
          (SELECT COUNT(*) FROM memorization_assignments) +
          (SELECT COUNT(*) FROM practice_assignments) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments)
        ),
        'completed', (
          (SELECT COUNT(*) FROM memorization_assignments WHERE completed = true) +
          (SELECT COUNT(*) FROM practice_assignments WHERE completed = true) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments WHERE completed = true)
        ),
        'in_progress', (
          (SELECT COUNT(*) FROM memorization_assignments WHERE completed = false) +
          (SELECT COUNT(*) FROM practice_assignments WHERE completed = false) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments WHERE completed = false)
        ),
        'overdue', (
          (SELECT COUNT(*) FROM memorization_assignments WHERE completed = false AND due_date < now()) +
          (SELECT COUNT(*) FROM practice_assignments WHERE completed = false AND due_date < now()) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments WHERE completed = false AND due_date < now())
        )
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function 2: Get detailed list of all assignments for admin view
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
  is_overdue boolean
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
      (ma.completed = false AND ma.due_date < now()) as is_overdue
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
      (COALESCE(pa.completed, false) = false AND pa.due_date < now()) as is_overdue
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
      (ppa.completed = false AND ppa.due_date < now()) as is_overdue
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

-- Function 3: Get all assignments for a specific student
CREATE OR REPLACE FUNCTION get_student_assignments_unified(target_user_id uuid)
RETURNS TABLE (
  assignment_id uuid,
  assignment_type text,
  title text,
  assigned_at timestamptz,
  assigned_by_username text,
  due_date timestamptz,
  completed boolean,
  completed_at timestamptz,
  is_overdue boolean,
  content_data jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH all_assignments AS (
    -- Memorization assignments
    SELECT 
      ma.id as assignment_id,
      'memorization'::text as assignment_type,
      sc.title as title,
      ma.assigned_at,
      u.username as assigned_by_username,
      ma.due_date,
      ma.completed,
      ma.completed_at,
      (ma.completed = false AND ma.due_date < now()) as is_overdue,
      jsonb_build_object(
        'content_id', sc.id,
        'original_text', sc.original_text,
        'selected_word_indices', sc.selected_word_indices
      ) as content_data
    FROM memorization_assignments ma
    JOIN saved_contents sc ON ma.content_id = sc.id
    LEFT JOIN users u ON ma.assigned_by = u.id
    WHERE ma.user_id = target_user_id
    
    UNION ALL
    
    -- Spelling assignments
    SELECT 
      pa.id as assignment_id,
      'spelling'::text as assignment_type,
      sp.title as title,
      pa.assigned_at,
      u.username as assigned_by_username,
      pa.due_date,
      COALESCE(pa.completed, false) as completed,
      pa.completed_at,
      (COALESCE(pa.completed, false) = false AND pa.due_date < now()) as is_overdue,
      jsonb_build_object(
        'practice_id', sp.id,
        'words', sp.words
      ) as content_data
    FROM practice_assignments pa
    JOIN spelling_practices sp ON pa.practice_id = sp.id
    LEFT JOIN users u ON pa.assigned_by = u.id
    WHERE pa.user_id = target_user_id
    
    UNION ALL
    
    -- Proofreading assignments
    SELECT 
      ppa.id as assignment_id,
      'proofreading'::text as assignment_type,
      pp.title as title,
      ppa.assigned_at,
      u.username as assigned_by_username,
      ppa.due_date,
      ppa.completed,
      ppa.completed_at,
      (ppa.completed = false AND ppa.due_date < now()) as is_overdue,
      jsonb_build_object(
        'practice_id', pp.id,
        'sentences', pp.sentences,
        'answers', pp.answers
      ) as content_data
    FROM proofreading_practice_assignments ppa
    JOIN proofreading_practices pp ON ppa.practice_id = pp.id
    LEFT JOIN users u ON ppa.assigned_by = u.id
    WHERE ppa.user_id = target_user_id
  )
  SELECT * FROM all_assignments
  ORDER BY
    CASE WHEN completed THEN 1 ELSE 0 END,
    due_date NULLS LAST,
    assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function 4: Get all overdue assignments
CREATE OR REPLACE FUNCTION get_overdue_assignments()
RETURNS TABLE (
  assignment_id uuid,
  assignment_type text,
  student_id uuid,
  student_username text,
  student_display_name text,
  title text,
  due_date timestamptz,
  days_overdue integer
) AS $$
BEGIN
  RETURN QUERY
  WITH overdue AS (
    -- Memorization
    SELECT 
      ma.id,
      'memorization'::text,
      ma.user_id,
      u.username,
      COALESCE(u.display_name, u.username),
      sc.title,
      ma.due_date,
      EXTRACT(DAY FROM (now() - ma.due_date))::integer
    FROM memorization_assignments ma
    JOIN users u ON ma.user_id = u.id
    JOIN saved_contents sc ON ma.content_id = sc.id
    WHERE ma.completed = false AND ma.due_date < now()
    
    UNION ALL
    
    -- Spelling
    SELECT 
      pa.id,
      'spelling'::text,
      pa.user_id,
      u.username,
      COALESCE(u.display_name, u.username),
      sp.title,
      pa.due_date,
      EXTRACT(DAY FROM (now() - pa.due_date))::integer
    FROM practice_assignments pa
    JOIN users u ON pa.user_id = u.id
    JOIN spelling_practices sp ON pa.practice_id = sp.id
    WHERE COALESCE(pa.completed, false) = false AND pa.due_date < now()
    
    UNION ALL
    
    -- Proofreading
    SELECT 
      ppa.id,
      'proofreading'::text,
      ppa.user_id,
      u.username,
      COALESCE(u.display_name, u.username),
      pp.title,
      ppa.due_date,
      EXTRACT(DAY FROM (now() - ppa.due_date))::integer
    FROM proofreading_practice_assignments ppa
    JOIN users u ON ppa.user_id = u.id
    JOIN proofreading_practices pp ON ppa.practice_id = pp.id
    WHERE ppa.completed = false AND ppa.due_date < now()
  )
  SELECT * FROM overdue
  ORDER BY due_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Function 5: Mark spelling assignment as complete
CREATE OR REPLACE FUNCTION mark_spelling_assignment_complete(
  target_assignment_id uuid,
  target_user_id uuid
)
RETURNS json AS $$
DECLARE
  result json;
  rows_updated integer;
BEGIN
  UPDATE practice_assignments
  SET 
    completed = true,
    completed_at = now(),
    updated_at = now()
  WHERE id = target_assignment_id
    AND user_id = target_user_id
    AND completed = false;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  IF rows_updated > 0 THEN
    result := json_build_object(
      'success', true,
      'message', 'Assignment marked as complete'
    );
  ELSE
    result := json_build_object(
      'success', false,
      'message', 'Assignment not found or already completed'
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;