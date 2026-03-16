-- Migration: Add Student Practice Levels and Visibility Rules
-- Description: Adds reading_level and proofreading_level to users, level to proofreading/reading practices, and updates RPCs for filtering.

-- 1. Update users table with new level columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reading_level integer DEFAULT 1;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS proofreading_level integer DEFAULT 1;

-- 2. Add level to practice tables for consistent filtering
ALTER TABLE public.reading_practices ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;
ALTER TABLE public.proofreading_practices ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;

-- 3. Update update_user_info RPC to handle new fields
CREATE OR REPLACE FUNCTION update_user_info(
    target_user_id uuid,
    new_username text DEFAULT NULL,
    new_display_name text DEFAULT NULL,
    new_class_number text DEFAULT NULL,
    new_student_id text DEFAULT NULL,
    new_role text DEFAULT NULL,
    new_spelling_level integer DEFAULT NULL,
    new_reading_level integer DEFAULT NULL,
    new_proofreading_level integer DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE users
    SET
        username = COALESCE(new_username, username),
        display_name = COALESCE(new_display_name, display_name),
        class_number = COALESCE(new_class_number, class_number),
        student_id = COALESCE(new_student_id, student_id),
        role = COALESCE(new_role, role),
        spelling_level = COALESCE(new_spelling_level, spelling_level),
        reading_level = COALESCE(new_reading_level, reading_level),
        proofreading_level = COALESCE(new_proofreading_level, proofreading_level),
        updated_at = now()
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update get_student_assignments_unified to enforce level-based visibility rules
-- Rule: Students in level 1 can see everything (advanced levels).
-- Students in advanced levels (2+) cannot see easier levels (1).
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
  target_spelling_level integer;
  target_reading_level integer;
  target_proofreading_level integer;
BEGIN
  -- Get the student's levels
  SELECT 
    COALESCE(spelling_level, 1),
    COALESCE(reading_level, 1),
    COALESCE(proofreading_level, 1)
  INTO 
    target_spelling_level,
    target_reading_level,
    target_proofreading_level
  FROM users WHERE id = target_user_id;

  RETURN QUERY
  WITH all_assignments AS (
    -- Memorization assignments (No level logic specified yet)
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
    -- Rule: Level 1 sees everything. Level 2+ restricted to their own level.
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
      (target_spelling_level = 1) 
      OR (target_spelling_level >= 2 AND COALESCE(pa.level, 1) >= target_spelling_level)
    )
    
    UNION ALL
    
    -- Proofreading assignments
    -- Rule: Level 1 sees everything. Level 2+ restricted to their own level or higher.
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
      pp.level as assignment_level
    FROM proofreading_practice_assignments ppa
    JOIN proofreading_practices pp ON ppa.practice_id = pp.id
    LEFT JOIN users u ON ppa.assigned_by = u.id
    WHERE ppa.user_id = target_user_id
    AND (
      (target_proofreading_level = 1)
      OR (target_proofreading_level >= 2 AND COALESCE(pp.level, 1) >= target_proofreading_level)
    )

    UNION ALL

    -- Reading assignments
    -- Rule: Level 1 sees everything. Level 2+ restricted to their own level or higher.
    SELECT 
      rp.id as assignment_id,
      'reading'::text as assignment_type,
      rp.title as title,
      rp.created_at as assigned_at,
      u.username as assigned_by_username,
      NULL::timestamptz as due_date,
      false as completed,
      NULL::timestamptz as completed_at,
      false as is_overdue,
      jsonb_build_object(
        'practice_id', rp.id,
        'passage_image_url', rp.passage_image_url
      ) as content_data,
      rp.level as assignment_level
    FROM reading_practices rp
    LEFT JOIN users u ON rp.created_by = u.id
    WHERE (
      (target_reading_level = 1)
      OR (target_reading_level >= 2 AND COALESCE(rp.level, 1) >= target_reading_level)
    )
    AND rp.is_deleted = false

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

-- 5. Restore Missing Grants
GRANT EXECUTE ON FUNCTION get_student_assignments_unified(uuid) TO authenticated, service_role;
