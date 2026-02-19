-- Function to get the count of cards due today for a user
CREATE OR REPLACE FUNCTION public.get_cards_due_today(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  due_count integer;
BEGIN
  SELECT count(*)
  INTO due_count
  FROM public.spaced_repetition_schedules
  WHERE user_id = p_user_id
    AND next_review_date <= now();
  
  RETURN COALESCE(due_count, 0);
END;
$$;

-- Function to get detailed card stats for a user
CREATE OR REPLACE FUNCTION public.get_user_card_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_learned integer;
  total_mastered integer;
BEGIN
  -- Total learned: Questions with at least one attempt
  SELECT count(DISTINCT question_id)
  INTO total_learned
  FROM public.spaced_repetition_attempts
  WHERE user_id = p_user_id;

  -- Total mastered: SM-2 criteria (Ease Factor >= 3.0 AND Interval >= 21 days)
  SELECT count(*)
  INTO total_mastered
  FROM public.spaced_repetition_schedules
  WHERE user_id = p_user_id
    AND ease_factor >= 3.0
    AND interval_days >= 21;

  RETURN jsonb_build_object(
    'total_learned', COALESCE(total_learned, 0),
    'total_mastered', COALESCE(total_mastered, 0)
  );
END;
$$;
