-- Diagnostic function to calculate coin stats for a specific class
CREATE OR REPLACE FUNCTION get_class_coin_stats(p_class_name text)
RETURNS TABLE (
  display_name text,
  user_id uuid,
  current_coins int,
  manual_record_total bigint,
  automated_potential bigint,
  total_historical_potential bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH student_manual AS (
    SELECT 
      sr.student_id,
      SUM(sr.coin_amount) as total_manual
    FROM student_records sr
    GROUP BY sr.student_id
  ),
  student_practice AS (
    -- Spelling (5), Proofing (5), Memo (5)
    SELECT 
      u.id as user_id,
      COALESCE(s.count * 5, 0) + COALESCE(p.count * 5, 0) + COALESCE(m.count * 5, 0) as total_practice_potential
    FROM users u
    LEFT JOIN (SELECT user_id, COUNT(*) as count FROM spelling_practice_results GROUP BY user_id) s ON u.id = s.user_id
    LEFT JOIN (SELECT user_id, COUNT(*) as count FROM proofreading_practice_results GROUP BY user_id) p ON u.id = p.user_id
    LEFT JOIN (SELECT user_id, COUNT(*) as count FROM memorization_practice_sessions GROUP BY user_id) m ON u.id = m.user_id
  )
  SELECT 
    COALESCE(u.display_name, u.username) as display_name,
    u.id,
    COALESCE(urd.coins, 0) as current_coins,
    COALESCE(sm.total_manual, 0) as manual_record_total,
    COALESCE(sp.total_practice_potential, 0) as automated_potential,
    COALESCE(sm.total_manual, 0) + COALESCE(sp.total_practice_potential, 0) as total_historical_potential
  FROM users u
  LEFT JOIN user_room_data urd ON u.id = urd.user_id
  LEFT JOIN student_manual sm ON u.id = sm.student_id
  LEFT JOIN student_practice sp ON u.id = sp.user_id
  WHERE u.class = p_class_name
    AND u.role = 'user'
  ORDER BY current_coins DESC;
END;
$$;
