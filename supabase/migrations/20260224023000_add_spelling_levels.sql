-- Migration: Add Spelling Levels
-- Description: Adds spelling level to users and assignments, and updates functions to enforce level-based rules.

-- 1. Add columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS spelling_level integer DEFAULT 1;
ALTER TABLE public.practice_assignments ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;

-- 2. Update update_user_info RPC
CREATE OR REPLACE FUNCTION update_user_info(
  caller_user_id uuid,
  target_user_id uuid,
  new_username text DEFAULT NULL,
  new_display_name text DEFAULT NULL,
  new_role text DEFAULT NULL,
  new_class text DEFAULT NULL,
  new_seat_number integer DEFAULT NULL,
  new_spelling_level integer DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  updated_user json;
  first_admin_id uuid;
  current_role text;
  current_seat_number integer;
  current_spelling_level integer;
BEGIN
  -- System Role Bypass (Edge Functions)
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
     NULL; 
  ELSE
     -- Admin Check for direct RPC calls
     SELECT role INTO current_role FROM users WHERE id = caller_user_id;
     IF current_role != 'admin' OR current_role IS NULL THEN
       RAISE EXCEPTION 'Only admins can update user information. Caller ID: %, Role: %', caller_user_id, COALESCE(current_role, 'NULL');
     END IF;
  END IF;

  -- Super admin protection
  SELECT id INTO first_admin_id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;
  IF target_user_id = first_admin_id AND new_role IS NOT NULL AND new_role != 'admin' THEN
    RAISE EXCEPTION 'Cannot change super admin role';
  END IF;

  -- DB Updates
  UPDATE users SET
    username = COALESCE(new_username, username),
    display_name = COALESCE(new_display_name, display_name),
    role = COALESCE(new_role, role),
    class = CASE WHEN new_class IS NOT NULL THEN new_class ELSE class END,
    spelling_level = COALESCE(new_spelling_level, spelling_level)
  WHERE id = target_user_id;

  IF new_seat_number IS NOT NULL THEN
    UPDATE users SET seat_number = new_seat_number WHERE id = target_user_id;
    IF NOT FOUND THEN
      -- This fallback is unlikely given the current setup but kept for consistency with previous migration
      INSERT INTO users (id, seat_number, display_name, created_at)
      SELECT id, new_seat_number, display_name, created_at FROM users WHERE id = target_user_id;
    END IF;
  END IF;

  SELECT seat_number, spelling_level INTO current_seat_number, current_spelling_level FROM users WHERE id = target_user_id;

  SELECT json_build_object(
    'id', id, 
    'username', username, 
    'role', role, 
    'display_name', display_name, 
    'class', class, 
    'seat_number', current_seat_number,
    'spelling_level', current_spelling_level,
    'created_at', created_at
  ) INTO updated_user FROM users WHERE id = target_user_id;

  RETURN updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp, extensions;

-- 3. Update get_student_assignments_unified to support level filtering
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
    -- Memorization assignments (no level logic yet, default to NULL or 1)
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
        'selected_word_indices', sc.selected_word_indices
      ) as content_data,
      NULL::integer as assignment_level
    FROM memorization_assignments ma
    JOIN saved_contents sc ON ma.content_id = sc.id
    LEFT JOIN users u ON ma.assigned_by = u.id
    WHERE ma.user_id = target_user_id
    
    UNION ALL
    
    -- Spelling assignments with level filtering
    -- Rule: Level 1 students see both levels. Level 2 students only see level 2.
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
      (target_user_level = 1) -- Level 1 students see everything
      OR (target_user_level = 2 AND COALESCE(pa.level, 1) = 2) -- Level 2 students only see level 2
    )
    
    UNION ALL
    
    -- Proofreading assignments (no level logic yet, default to NULL or 1)
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
  )
  SELECT * FROM all_assignments
  ORDER BY
    CASE WHEN completed THEN 1 ELSE 0 END,
    due_date NULLS LAST,
    assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
