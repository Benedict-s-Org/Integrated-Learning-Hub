-- Migration: Fix ambiguous column reference in get_student_assignments_unified
-- Bug: "column reference 'completed' is ambiguous" because PL/pgSQL return
-- column names conflict with CTE column references.
-- Fix: Qualify all column references in the ORDER BY with the CTE alias.

DROP FUNCTION IF EXISTS get_student_assignments_unified(uuid);
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
    COALESCE(u2.spelling_level, 1),
    COALESCE(u2.reading_rearranging_level, 1),
    COALESCE(u2.reading_proofreading_level, 1),
    COALESCE(u2.proofreading_level, 1),
    COALESCE(u2.memorization_level, 1)
  INTO 
    target_spelling_level,
    target_reading_rearranging_level,
    target_reading_proofreading_level,
    target_proofreading_level,
    target_memorization_level
  FROM users u2 WHERE u2.id = target_user_id;

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

    -- Explicit Reading Assignments
    SELECT 
      ra.id as assignment_id,
      'reading'::text as assignment_type,
      rp.title as title,
      ra.assigned_at,
      u.username as assigned_by_username,
      ra.due_date,
      ra.completed,
      ra.completed_at,
      (ra.completed = false AND ra.due_date < now()) as is_overdue,
      jsonb_build_object(
        'practice_id', rp.id,
        'passage_image_url', rp.passage_image_url,
        'interaction_type', (SELECT rq.interaction_type FROM reading_questions rq WHERE rq.practice_id = rp.id LIMIT 1)
      ) as content_data,
      rp.level as assignment_level
    FROM reading_practice_assignments ra
    JOIN reading_practices rp ON ra.practice_id = rp.id
    LEFT JOIN users u ON ra.assigned_by = u.id
    WHERE ra.user_id = target_user_id

    UNION ALL

    -- Level-based Reading practices (fallback/legacy)
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
    AND NOT EXISTS (
      SELECT 1 FROM reading_practice_assignments ra 
      WHERE ra.practice_id = rp.id AND ra.user_id = target_user_id
    )
    AND (
      (q.interaction_type = 'rearrange' AND (
        (target_reading_rearranging_level = 1)
        OR (target_reading_rearranging_level >= 2 AND COALESCE(rp.level, 1) >= target_reading_rearranging_level)
      ))
      OR (q.interaction_type = 'proofreading' AND (
        (target_reading_proofreading_level = 1)
        OR (target_reading_proofreading_level >= 2 AND COALESCE(rp.level, 1) >= target_reading_proofreading_level)
      ))
      OR (q.interaction_type IS NULL AND (
        (target_reading_rearranging_level = 1)
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
  SELECT aa.* FROM all_assignments aa
  ORDER BY
    CASE WHEN aa.completed THEN 1 ELSE 0 END,
    aa.due_date NULLS LAST,
    aa.assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION get_student_assignments_unified(uuid) TO authenticated, service_role;
