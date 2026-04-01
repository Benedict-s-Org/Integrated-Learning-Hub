-- Migration: Update mark_assignment_complete to award coins and handle reading
-- Path: supabase/migrations/20260330053800_fix_assignment_completion_coins.sql

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
  v_reward_coins integer := 5; -- fallback default
  v_practice_id uuid;
  v_title text;
  v_table_name text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Identify Practice and Reward based on type
  IF p_assignment_type = 'spelling' THEN
    SELECT practice_id, p.title, COALESCE(p.reward_coins, 5)
    INTO v_practice_id, v_title, v_reward_coins
    FROM practice_assignments a
    JOIN spelling_practices p ON a.practice_id = p.id
    WHERE a.id = p_assignment_id AND a.user_id = v_user_id;
    
    v_table_name := 'practice_assignments';
    
  ELSIF p_assignment_type = 'memorization' THEN
    -- Memorization doesn't have a practice table yet, uses saved_contents
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
    
  ELSE
    RAISE EXCEPTION 'Invalid assignment type: %', p_assignment_type;
  END IF;

  -- 2. Update the assignment status
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
  END IF;

  -- 3. Award coins and return success if update was successful
  IF FOUND THEN
    -- CALL THE COIN AWARD SYSTEM (FIXED!)
    PERFORM public.increment_room_coins(
        v_user_id,
        v_reward_coins,
        '完成' || p_assignment_type || ': ' || v_title,
        NULL, -- NULL admin ID for automated awards
        NULL,
        FALSE -- Do not skip daily count
    );
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
