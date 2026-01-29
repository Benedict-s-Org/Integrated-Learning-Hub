/*
  # Session Management Database Functions

  ## Functions Created
  1. `create_session` - Creates a new session for authenticated user
  2. `validate_session` - Validates and retrieves session details
  3. `delete_session` - Ends a user session
  4. `update_session_validation` - Updates last_validated timestamp

  ## Security
  All functions use SECURITY DEFINER to ensure they work correctly with RLS policies.
*/

CREATE OR REPLACE FUNCTION create_session(user_id_input uuid)
RETURNS TABLE(session_id uuid, expires_at timestamptz) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO sessions (user_id, expires_at, last_validated)
  VALUES (user_id_input, now() + interval '30 days', now())
  RETURNING sessions.id, sessions.expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION validate_session(session_id uuid)
RETURNS TABLE(
  is_valid boolean,
  user_id uuid,
  expires_at timestamptz
) AS $$
DECLARE
  v_user_id uuid;
  v_expires_at timestamptz;
  v_is_valid boolean;
BEGIN
  SELECT sessions.user_id, sessions.expires_at
  INTO v_user_id, v_expires_at
  FROM sessions
  WHERE sessions.id = session_id
  AND sessions.expires_at > now();

  IF v_user_id IS NOT NULL THEN
    UPDATE sessions
    SET last_validated = now()
    WHERE id = session_id;
    v_is_valid := true;
  ELSE
    v_is_valid := false;
  END IF;

  RETURN QUERY SELECT v_is_valid, v_user_id, v_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_session(session_id uuid)
RETURNS boolean AS $$
BEGIN
  DELETE FROM sessions WHERE id = session_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_sessions(user_id_input uuid)
RETURNS TABLE(
  session_id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  last_validated timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sessions.id,
    sessions.created_at,
    sessions.expires_at,
    sessions.last_validated
  FROM sessions
  WHERE sessions.user_id = user_id_input
  AND sessions.expires_at > now()
  ORDER BY sessions.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
