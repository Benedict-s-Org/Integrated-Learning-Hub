/*
  # Update Ranking Functions to Include Class

  1. Changes
    - Drop and recreate get_spelling_rankings function to include class information
    - Drop and recreate get_proofreading_rankings function to include class information
    - This allows filtering and displaying rankings by class

  2. Notes
    - Rankings will now include the user's class
    - Frontend can filter rankings by class for class-specific leaderboards
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS get_spelling_rankings();
DROP FUNCTION IF EXISTS get_proofreading_rankings();

-- Create spelling rankings function with class
CREATE OR REPLACE FUNCTION get_spelling_rankings()
RETURNS TABLE (
  user_id uuid,
  username text,
  total_practices bigint,
  average_accuracy numeric,
  rank bigint,
  class text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    u.username,
    COUNT(spr.id) AS total_practices,
    ROUND(AVG(spr.accuracy_percentage), 1) AS average_accuracy,
    RANK() OVER (ORDER BY AVG(spr.accuracy_percentage) DESC, COUNT(spr.id) DESC) AS rank,
    u.class
  FROM users u
  INNER JOIN spelling_practice_results spr ON u.id = spr.user_id
  WHERE u.role = 'user'
  GROUP BY u.id, u.username, u.class
  HAVING COUNT(spr.id) >= 3
  ORDER BY rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Create proofreading rankings function with class
CREATE OR REPLACE FUNCTION get_proofreading_rankings()
RETURNS TABLE (
  user_id uuid,
  username text,
  total_practices bigint,
  average_accuracy numeric,
  rank bigint,
  class text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    u.username,
    COUNT(ppr.id) AS total_practices,
    ROUND(AVG(ppr.accuracy_percentage), 1) AS average_accuracy,
    RANK() OVER (ORDER BY AVG(ppr.accuracy_percentage) DESC, COUNT(ppr.id) DESC) AS rank,
    u.class
  FROM users u
  INNER JOIN proofreading_practice_results ppr ON u.id = ppr.user_id
  WHERE u.role = 'user'
  GROUP BY u.id, u.username, u.class
  HAVING COUNT(ppr.id) >= 3
  ORDER BY rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
