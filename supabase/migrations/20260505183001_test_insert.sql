CREATE OR REPLACE FUNCTION test_insert_admin_attempt(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_err text;
  v_question_id uuid;
BEGIN
  SELECT id INTO v_question_id FROM spaced_repetition_questions LIMIT 1;

  INSERT INTO spaced_repetition_attempts (
    user_id, question_id, selected_answer_index, is_correct, response_time_ms, quality_rating
  ) VALUES (
    p_admin_id, v_question_id, 1, true, 1000, 5
  );
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
