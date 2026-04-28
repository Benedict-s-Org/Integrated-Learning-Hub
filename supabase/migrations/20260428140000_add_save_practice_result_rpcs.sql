-- ============================================================
-- Migration: Add SECURITY DEFINER RPC functions for saving
-- practice results reliably, bypassing RLS INSERT restrictions.
--
-- Problem: Direct table INSERTs via Supabase client can be
-- silently blocked by RLS policies (returning { error: null })
-- when auth.uid() doesn't exactly match user_id. These RPCs
-- use auth.uid() server-side so inserts are always authoritative.
-- ============================================================

-- -------------------------------------------------------
-- 1. save_proofreading_result
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_proofreading_result(
  p_practice_id       UUID,
  p_assignment_id     UUID,
  p_sentences         TEXT[],
  p_correct_answers   JSONB,
  p_user_answers      JSONB,
  p_correct_count     INTEGER,
  p_total_count       INTEGER,
  p_accuracy_percentage INTEGER,
  p_time_spent_seconds  INTEGER,
  p_completed_at      TIMESTAMPTZ,
  p_tips_used         JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_record_id UUID;
BEGIN
  -- Always use the server-side auth.uid() – cannot be spoofed by client
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  INSERT INTO public.proofreading_practice_results (
    user_id,
    practice_id,
    assignment_id,
    sentences,
    correct_answers,
    user_answers,
    correct_count,
    total_count,
    accuracy_percentage,
    time_spent_seconds,
    completed_at,
    tips_used,
    created_at
  ) VALUES (
    v_user_id,
    p_practice_id,
    p_assignment_id,
    p_sentences,
    p_correct_answers,
    p_user_answers,
    p_correct_count,
    p_total_count,
    p_accuracy_percentage,
    p_time_spent_seconds,
    COALESCE(p_completed_at, NOW()),
    COALESCE(p_tips_used, '[]'::JSONB),
    NOW()
  )
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object('success', true, 'id', v_record_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.save_proofreading_result(UUID, UUID, TEXT[], JSONB, JSONB, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, JSONB) TO authenticated;


-- -------------------------------------------------------
-- 2. save_spelling_result
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_spelling_result(
  p_practice_id           UUID,
  p_assignment_id         UUID,
  p_title                 TEXT,
  p_words                 TEXT[],
  p_user_answers          JSONB,
  p_correct_count         INTEGER,
  p_total_count           INTEGER,
  p_accuracy_percentage   INTEGER,
  p_practice_level        INTEGER,
  p_time_spent_seconds    INTEGER,
  p_completed_at          TIMESTAMPTZ,
  p_is_srs                BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_record_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  INSERT INTO public.spelling_practice_results (
    user_id,
    practice_id,
    assignment_id,
    title,
    words,
    user_answers,
    correct_count,
    total_count,
    accuracy_percentage,
    practice_level,
    time_spent_seconds,
    completed_at,
    is_srs,
    created_at
  ) VALUES (
    v_user_id,
    p_practice_id,
    p_assignment_id,
    p_title,
    p_words,
    p_user_answers,
    p_correct_count,
    p_total_count,
    p_accuracy_percentage,
    p_practice_level,
    p_time_spent_seconds,
    COALESCE(p_completed_at, NOW()),
    COALESCE(p_is_srs, FALSE),
    NOW()
  )
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object('success', true, 'id', v_record_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_spelling_result(UUID, UUID, TEXT, TEXT[], JSONB, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ, BOOLEAN) TO authenticated;


-- -------------------------------------------------------
-- 3. save_memorization_session
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_memorization_session(
  p_assignment_id           UUID,
  p_title                   TEXT,
  p_original_text           TEXT,
  p_total_words             INTEGER,
  p_hidden_words_count      INTEGER,
  p_session_duration_seconds INTEGER,
  p_completed_at            TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_record_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  INSERT INTO public.memorization_practice_sessions (
    user_id,
    assignment_id,
    title,
    original_text,
    total_words,
    hidden_words_count,
    session_duration_seconds,
    completed_at,
    created_at
  ) VALUES (
    v_user_id,
    p_assignment_id,
    p_title,
    p_original_text,
    p_total_words,
    p_hidden_words_count,
    p_session_duration_seconds,
    COALESCE(p_completed_at, NOW()),
    NOW()
  )
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object('success', true, 'id', v_record_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_memorization_session(UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ) TO authenticated;
