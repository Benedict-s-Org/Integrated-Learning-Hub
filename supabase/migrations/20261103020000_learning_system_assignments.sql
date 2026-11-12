-- Learning System assignment type (DEC-20261102-20).
-- Assign → deep-link into hub Practice → mark_assignment_complete on set finish.
-- Legacy spaced_repetition completion gap left unchanged.

CREATE TABLE IF NOT EXISTS public.learning_system_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Learning System practice',
  grade_key text CHECK (grade_key IS NULL OR grade_key IN ('P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6')),
  due_date timestamptz,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  reward_coins integer NOT NULL DEFAULT 5,
  notes text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ls_assignments_user
  ON public.learning_system_assignments (user_id, completed, assigned_at DESC);

ALTER TABLE public.learning_system_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LS assignments select" ON public.learning_system_assignments;
CREATE POLICY "LS assignments select" ON public.learning_system_assignments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );

DROP POLICY IF EXISTS "LS assignments staff insert" ON public.learning_system_assignments;
CREATE POLICY "LS assignments staff insert" ON public.learning_system_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );

DROP POLICY IF EXISTS "LS assignments update own or staff" ON public.learning_system_assignments;
CREATE POLICY "LS assignments update own or staff" ON public.learning_system_assignments FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );

DROP POLICY IF EXISTS "LS assignments staff delete" ON public.learning_system_assignments;
CREATE POLICY "LS assignments staff delete" ON public.learning_system_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'class_staff'))
  );

-- Unified inbox includes learning_system
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

    UNION ALL

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

    UNION ALL

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

    UNION ALL

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

    -- Spaced Repetition: ongoing — no due, not homework-complete (unchanged this round)
    SELECT
      sa.id as assignment_id,
      'spaced_repetition'::text as assignment_type,
      srs.title as title,
      sa.assigned_at,
      u.username as assigned_by_username,
      NULL::timestamptz as due_date,
      false as completed,
      NULL::timestamptz as completed_at,
      false as is_overdue,
      jsonb_build_object(
        'set_id', srs.id,
        'description', srs.description
      ) as content_data,
      NULL::integer as assignment_level
    FROM set_assignments sa
    JOIN spaced_repetition_sets srs ON sa.set_id = srs.id
    LEFT JOIN users u ON sa.assigned_by = u.id
    WHERE sa.user_id = target_user_id

    UNION ALL

    -- Learning System (DEC-20261102-20): completable one-set practice
    SELECT
      lsa.id as assignment_id,
      'learning_system'::text as assignment_type,
      lsa.title as title,
      lsa.assigned_at,
      u.username as assigned_by_username,
      lsa.due_date,
      lsa.completed,
      lsa.completed_at,
      (lsa.completed = false AND lsa.due_date IS NOT NULL AND lsa.due_date < now()) as is_overdue,
      jsonb_build_object(
        'grade_key', lsa.grade_key,
        'notes', lsa.notes,
        'reward_coins', lsa.reward_coins
      ) as content_data,
      NULL::integer as assignment_level
    FROM learning_system_assignments lsa
    LEFT JOIN users u ON lsa.assigned_by = u.id
    WHERE lsa.user_id = target_user_id
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

-- Extend mark_assignment_complete for learning_system
CREATE OR REPLACE FUNCTION public.mark_assignment_complete(
  p_assignment_id uuid,
  p_assignment_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_reward_coins integer := 5;
  v_practice_id uuid;
  v_title text;
  v_table_name text;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_assignment_type = 'spelling' THEN
    SELECT practice_id, p.title, COALESCE(p.reward_coins, 5)
    INTO v_practice_id, v_title, v_reward_coins
    FROM practice_assignments a
    JOIN spelling_practices p ON a.practice_id = p.id
    WHERE a.id = p_assignment_id AND a.user_id = v_user_id;
    v_table_name := 'practice_assignments';

  ELSIF p_assignment_type = 'memorization' THEN
    SELECT content_id, title, 5
    INTO v_practice_id, v_title, v_reward_coins
    FROM memorization_assignments
    WHERE id = p_assignment_id AND user_id = v_user_id;
    v_table_name := 'memorization_assignments';

  ELSIF p_assignment_type = 'proofreading' THEN
    SELECT practice_id, p.title, COALESCE(p.reward_coins, 5)
    INTO v_practice_id, v_title, v_reward_coins
    FROM proofreading_practice_assignments a
    JOIN proofreading_practices p ON a.practice_id = p.id
    WHERE a.id = p_assignment_id AND a.user_id = v_user_id;
    v_table_name := 'proofreading_practice_assignments';

  ELSIF p_assignment_type = 'reading' THEN
    SELECT practice_id, p.title, COALESCE(p.reward_coins, 10)
    INTO v_practice_id, v_title, v_reward_coins
    FROM reading_practice_assignments a
    JOIN reading_practices p ON a.practice_id = p.id
    WHERE a.id = p_assignment_id AND a.user_id = v_user_id;
    v_table_name := 'reading_practice_assignments';

  ELSIF p_assignment_type = 'learning_system' THEN
    SELECT id, title, COALESCE(reward_coins, 5)
    INTO v_practice_id, v_title, v_reward_coins
    FROM learning_system_assignments
    WHERE id = p_assignment_id AND user_id = v_user_id;
    v_table_name := 'learning_system_assignments';

  ELSE
    RAISE EXCEPTION 'Invalid assignment type: %', p_assignment_type;
  END IF;

  IF v_table_name = 'practice_assignments' THEN
    UPDATE practice_assignments SET completed = true, completed_at = now()
    WHERE id = p_assignment_id AND user_id = v_user_id AND (completed = false OR completed IS NULL);
  ELSIF v_table_name = 'memorization_assignments' THEN
    UPDATE memorization_assignments SET completed = true, completed_at = now()
    WHERE id = p_assignment_id AND user_id = v_user_id AND (completed = false OR completed IS NULL);
  ELSIF v_table_name = 'proofreading_practice_assignments' THEN
    UPDATE proofreading_practice_assignments SET completed = true, completed_at = now()
    WHERE id = p_assignment_id AND user_id = v_user_id AND (completed = false OR completed IS NULL);
  ELSIF v_table_name = 'reading_practice_assignments' THEN
    UPDATE reading_practice_assignments SET completed = true, completed_at = now()
    WHERE id = p_assignment_id AND user_id = v_user_id AND (completed = false OR completed IS NULL);
  ELSIF v_table_name = 'learning_system_assignments' THEN
    UPDATE learning_system_assignments SET completed = true, completed_at = now()
    WHERE id = p_assignment_id AND user_id = v_user_id AND completed = false;
  END IF;

  IF FOUND THEN
    PERFORM public.increment_room_coins(
        v_user_id,
        v_reward_coins,
        CASE
          WHEN p_assignment_type = 'learning_system' THEN
            'Completed Learning System: ' || COALESCE(v_title, 'practice')
          ELSE
            '完成' || p_assignment_type || ': ' || COALESCE(v_title, '')
        END,
        NULL,
        NULL,
        FALSE
    );
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_assignment_complete(uuid, text) TO authenticated;
