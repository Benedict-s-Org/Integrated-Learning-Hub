-- Update get_student_assignments_unified to include spaced repetition assignments
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
      false as completed, -- Spaced repetition sets don't have a single "completed" flag in the same way
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

-- Ensure all current users have access to spaced repetition
UPDATE users SET can_access_spaced_repetition = true WHERE can_access_spaced_repetition = false OR can_access_spaced_repetition IS NULL;

-- Update the default for the column
ALTER TABLE users ALTER COLUMN can_access_spaced_repetition SET DEFAULT true;
