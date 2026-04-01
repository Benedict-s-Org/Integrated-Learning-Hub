-- Total Audit Diagnostic Function: Includes all automated reward sources
-- Path: supabase/migrations/20260330150000_audit_class_coin_discrepancies.sql

DROP FUNCTION IF EXISTS get_class_coin_stats(text);

CREATE OR REPLACE FUNCTION get_class_coin_stats(p_class_name text)
RETURNS TABLE (
  display_name text,
  actual_user_id uuid,
  current_coins int,
  manual_record_total bigint,
  spelling_potential bigint,
  proofreading_potential bigint,
  memorization_potential bigint,
  reading_potential bigint,
  total_audit_target bigint,
  discrepancy bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH 
  student_manual AS (
    SELECT 
      sr.student_id,
      SUM(sr.coin_amount) as total_manual
    FROM student_records sr
    WHERE (student_id IN (SELECT id FROM users WHERE class = p_class_name OR p_class_name IS NULL))
    GROUP BY sr.student_id
  ),
  spelling_count AS (
    SELECT user_id, COUNT(*) * 5 as coins
    FROM spelling_practice_results GROUP BY user_id
  ),
  proofreading_count AS (
    SELECT user_id, COUNT(*) * 5 as coins
    FROM proofreading_practice_results GROUP BY user_id
  ),
  memorization_count AS (
    SELECT user_id, COUNT(*) * 5 as coins
    FROM memorization_practice_sessions GROUP BY user_id
  ),
  reading_count AS (
    SELECT student_id as user_id, COUNT(*) FILTER (WHERE answer_status = 'perfect') * 5 as coins
    FROM reading_student_responses GROUP BY student_id
  )
  SELECT 
    COALESCE(u.display_name, u.username) as display_name,
    u.id,
    COALESCE(urd.coins, 0) as current_coins,
    COALESCE(sm.total_manual, 0) as manual_record_total,
    COALESCE(s.coins, 0) as spelling_potential,
    COALESCE(p.coins, 0) as proofreading_potential,
    COALESCE(m.coins, 0) as memorization_potential,
    COALESCE(r.coins, 0) as reading_potential,
    -- The target should be Manual + ALL Practices
    (COALESCE(sm.total_manual, 0) + COALESCE(s.coins, 0) + COALESCE(p.coins, 0) + COALESCE(m.coins, 0) + COALESCE(r.coins, 0)) as total_audit_target,
    -- Discrepancy (negative means they are missing coins)
    COALESCE(urd.coins, 0) - (COALESCE(sm.total_manual, 0) + COALESCE(s.coins, 0) + COALESCE(p.coins, 0) + COALESCE(m.coins, 0) + COALESCE(r.coins, 0)) as discrepancy
  FROM users u
  LEFT JOIN user_room_data urd ON u.id = urd.user_id
  LEFT JOIN student_manual sm ON u.id = sm.student_id
  LEFT JOIN spelling_count s ON u.id = s.user_id
  LEFT JOIN proofreading_count p ON u.id = p.user_id
  LEFT JOIN memorization_count m ON u.id = m.user_id
  LEFT JOIN reading_count r ON u.id = r.user_id
  WHERE (u.class = p_class_name OR p_class_name IS NULL)
    AND u.role = 'user'
  ORDER BY discrepancy ASC;
END;
$$;
