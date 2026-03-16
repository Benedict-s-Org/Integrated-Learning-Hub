-- Migration: Split Reading Levels & Add Memorization Level
-- Description: Renames reading_level to reading_rearranging_level, adds reading_proofreading_level and memorization_level.

-- 1. Update users table columns
ALTER TABLE public.users RENAME COLUMN reading_level TO reading_rearranging_level;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reading_proofreading_level integer DEFAULT 1;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS memorization_level integer DEFAULT 1;

-- 2. Update update_user_info RPC to handle all 5 level fields
CREATE OR REPLACE FUNCTION update_user_info(
    target_user_id uuid,
    new_username text DEFAULT NULL,
    new_display_name text DEFAULT NULL,
    new_class_number text DEFAULT NULL,
    new_student_id text DEFAULT NULL,
    new_role text DEFAULT NULL,
    new_spelling_level integer DEFAULT NULL,
    new_reading_rearranging_level integer DEFAULT NULL,
    new_reading_proofreading_level integer DEFAULT NULL,
    new_proofreading_level integer DEFAULT NULL,
    new_memorization_level integer DEFAULT NULL
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
        reading_rearranging_level = COALESCE(new_reading_rearranging_level, reading_rearranging_level),
        reading_proofreading_level = COALESCE(new_reading_proofreading_level, reading_proofreading_level),
        proofreading_level = COALESCE(new_proofreading_level, proofreading_level),
        memorization_level = COALESCE(new_memorization_level, memorization_level),
        updated_at = now()
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update get_student_assignments_unified with split reading logic
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
  target_reading_rearranging_level integer;
  target_reading_proofreading_level integer;
  target_proofreading_level integer;
  target_memorization_level integer;
BEGIN
  -- Get the student's levels
  SELECT 
    COALESCE(spelling_level, 1),
    COALESCE(reading_rearranging_level, 1),
    COALESCE(reading_proofreading_level, 1),
    COALESCE(proofreading_level, 1),
    COALESCE(memorization_level, 1)
  INTO 
    target_spelling_level,
    target_reading_rearranging_level,
    target_reading_proofreading_level,
    target_proofreading_level,
    target_memorization_level
  FROM users WHERE id = target_user_id;

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
      COALESCE(sc.level, 1) as assignment_level
    FROM memorization_assignments ma
    JOIN saved_contents sc ON ma.content_id = sc.id
    LEFT JOIN users u ON ma.assigned_by = u.id
    WHERE ma.user_id = target_user_id
    AND (
      (target_memorization_level = 1)
      OR (target_memorization_level >= 2 AND COALESCE(sc.level, 1) >= target_memorization_level)
    )
    
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
      (target_spelling_level = 1) 
      OR (target_spelling_level >= 2 AND COALESCE(pa.level, 1) >= target_spelling_level)
    )
    
    UNION ALL
    
    -- Standalone Proofreading assignments
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

    -- Reading practices (Rearranging & Proofreading mixed)
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
        'passage_image_url', rp.passage_image_url,
        'interaction_type', (SELECT rq.interaction_type FROM reading_questions rq WHERE rq.practice_id = rp.id LIMIT 1)
      ) as content_data,
      rp.level as assignment_level
    FROM reading_practices rp
    LEFT JOIN users u ON rp.created_by = u.id
    LEFT JOIN LATERAL (
      SELECT rq.interaction_type 
      FROM reading_questions rq 
      WHERE rq.practice_id = rp.id 
      LIMIT 1
    ) q ON true
    WHERE rp.is_deleted = false
    AND (
      -- Filter by interaction type
      (q.interaction_type = 'rearrange' AND (
        (target_reading_rearranging_level = 1)
        OR (target_reading_rearranging_level >= 2 AND COALESCE(rp.level, 1) >= target_reading_rearranging_level)
      ))
      OR (q.interaction_type = 'proofreading' AND (
        (target_reading_proofreading_level = 1)
        OR (target_reading_proofreading_level >= 2 AND COALESCE(rp.level, 1) >= target_reading_proofreading_level)
      ))
      OR (q.interaction_type IS NULL AND (
        (target_reading_rearranging_level = 1) -- Fallback
      ))
    )

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
