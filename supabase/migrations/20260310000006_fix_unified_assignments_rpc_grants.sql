-- Migration: Fix Unified Assignments RPC and Grants
-- Description: Drops and recreates the unified assignment functions to ensure correct column signatures and restores missing grants.

-- 1. Drop existing functions to handle return type changes
DROP FUNCTION IF EXISTS get_student_assignments_unified(uuid);
DROP FUNCTION IF EXISTS get_all_assignments_admin_view(text, text, uuid, text, text);
DROP FUNCTION IF EXISTS get_all_assignments_overview();

-- 2. Recreate get_student_assignments_unified with support for Spaced Repetition (11 columns)
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
  content_data jsonb,
  assignment_level integer
) AS $$
DECLARE
  target_user_level integer;
BEGIN
  -- Get the student's spelling level
  SELECT spelling_level INTO target_user_level FROM users WHERE id = target_user_id;
  target_user_level := COALESCE(target_user_level, 1);

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
        'selected_word_indices', sc.selected_word_indices,
        'practice_mode', COALESCE(sc.practice_mode, 'memorization')
      ) as content_data,
      NULL::integer as assignment_level
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
      ) as content_data,
      pa.level as assignment_level
    FROM practice_assignments pa
    JOIN spelling_practices sp ON pa.practice_id = sp.id
    LEFT JOIN users u ON pa.assigned_by = u.id
    WHERE pa.user_id = target_user_id
    AND (
      (target_user_level = 1) 
      OR (target_user_level = 2 AND COALESCE(pa.level, 1) = 2)
    )
    
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
      ) as content_data,
      NULL::integer as assignment_level
    FROM proofreading_practice_assignments ppa
    JOIN proofreading_practices pp ON ppa.practice_id = pp.id
    LEFT JOIN users u ON ppa.assigned_by = u.id
    WHERE ppa.user_id = target_user_id

    UNION ALL

    -- Spaced Repetition assignments
    SELECT 
      sa.id as assignment_id,
      'spaced_repetition'::text as assignment_type,
      srs.title as title,
      sa.assigned_at,
      u.username as assigned_by_username,
      sa.due_date,
      false as completed,
      NULL::timestamptz as completed_at,
      (sa.due_date < now()) as is_overdue,
      jsonb_build_object(
        'set_id', srs.id,
        'description', srs.description
      ) as content_data,
      NULL::integer as assignment_level
    FROM set_assignments sa
    JOIN spaced_repetition_sets srs ON sa.set_id = srs.id
    LEFT JOIN users u ON sa.assigned_by = u.id
    WHERE sa.user_id = target_user_id
  )
  SELECT * FROM all_assignments
  ORDER BY
    CASE WHEN completed THEN 1 ELSE 0 END,
    due_date NULLS LAST,
    assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 3. Recreate get_all_assignments_admin_view (13 columns)
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
    -- Memorization
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
    
    -- Spelling
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
    
    -- Proofreading
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

    UNION ALL

    -- Spaced Repetition
    SELECT 
      sa.id as assignment_id,
      'spaced_repetition'::text as assignment_type,
      sa.user_id as student_id,
      u.username as student_username,
      COALESCE(u.display_name, u.username) as student_display_name,
      srs.title as title,
      sa.assigned_at,
      au.username as assigned_by_username,
      sa.due_date,
      false as completed,
      NULL::timestamptz as completed_at,
      (sa.due_date < now()) as is_overdue,
      NULL::integer as assignment_level
    FROM set_assignments sa
    JOIN users u ON sa.user_id = u.id
    JOIN spaced_repetition_sets srs ON sa.set_id = srs.id
    LEFT JOIN users au ON sa.assigned_by = au.id
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

-- 4. Recreate get_all_assignments_overview with Spaced Repetition
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
    'spaced_repetition', (
      SELECT json_build_object(
        'total', COUNT(*),
        'completed', 0, -- Set assignments don't have a simple completed flag yet in this view
        'in_progress', COUNT(*),
        'overdue', COUNT(*) FILTER (WHERE due_date < now()),
        'completion_rate', 0
      )
      FROM set_assignments
    ),
    'total_across_all_types', (
      SELECT jsonb_build_object(
        'total', (
          (SELECT COUNT(*) FROM memorization_assignments) +
          (SELECT COUNT(*) FROM practice_assignments) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments) +
          (SELECT COUNT(*) FROM set_assignments)
        ),
        'completed', (
          (SELECT COUNT(*) FROM memorization_assignments WHERE completed = true) +
          (SELECT COUNT(*) FROM practice_assignments WHERE completed = true) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments WHERE completed = true)
        ),
        'in_progress', (
          (SELECT COUNT(*) FROM memorization_assignments WHERE completed = false) +
          (SELECT COUNT(*) FROM practice_assignments WHERE completed = false) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments WHERE completed = false) +
          (SELECT COUNT(*) FROM set_assignments)
        ),
        'overdue', (
          (SELECT COUNT(*) FROM memorization_assignments WHERE completed = false AND due_date < now()) +
          (SELECT COUNT(*) FROM practice_assignments WHERE completed = false AND due_date < now()) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments WHERE completed = false AND due_date < now()) +
          (SELECT COUNT(*) FROM set_assignments WHERE due_date < now())
        )
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- 5. Restore Missing Grants
GRANT EXECUTE ON FUNCTION get_student_assignments_unified(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_all_assignments_admin_view(text, text, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_all_assignments_overview() TO authenticated, service_role;
