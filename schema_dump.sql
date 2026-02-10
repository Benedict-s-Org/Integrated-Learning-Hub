


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."admin_change_user_password"("caller_user_id" "uuid", "target_user_id" "uuid", "new_password" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp', 'extensions'
    AS $$
DECLARE
  current_role text;
BEGIN
  -- Verify caller is an admin
  SELECT role INTO current_role FROM users WHERE id = caller_user_id;
  IF current_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change user passwords';
  END IF;

  -- Update the password (using crypt if available, or just set it if using a different system)
  -- Since we have pgcrypto from previous migrations:
  UPDATE users
  SET password_hash = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."admin_change_user_password"("caller_user_id" "uuid", "target_user_id" "uuid", "new_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_delete_user"("caller_user_id" "uuid", "target_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp', 'extensions'
    AS $$
DECLARE
  first_admin_id uuid;
BEGIN
  -- Check if caller is the first admin
  IF NOT is_first_admin(caller_user_id) THEN
    RETURN false;
  END IF;

  -- Get the first admin ID
  SELECT id INTO first_admin_id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Cannot delete the super admin
  IF target_user_id = first_admin_id THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."can_delete_user"("caller_user_id" "uuid", "target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_user_password"("user_id" "uuid", "new_password" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  UPDATE users
  SET 
    password_hash = crypt(new_password, gen_salt('bf')),
    force_password_change = false,
    updated_at = now()
  WHERE id = user_id;
END;
$$;


ALTER FUNCTION "public"."change_user_password"("user_id" "uuid", "new_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_sessions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM sessions
  WHERE expires_at < now();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_session"("user_id_input" "uuid") RETURNS TABLE("session_id" "uuid", "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  INSERT INTO sessions (user_id, expires_at, last_validated)
  VALUES (user_id_input, now() + interval '30 days', now())
  RETURNING sessions.id, sessions.expires_at;
END;
$$;


ALTER FUNCTION "public"."create_session"("user_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  new_user_id uuid;
  new_user json;
BEGIN
  INSERT INTO users (username, password_hash, role, can_access_proofreading, can_access_spelling)
  VALUES (
    username_input,
    crypt(password_input, gen_salt('bf')),
    role_input,
    CASE WHEN role_input = 'admin' THEN true ELSE false END,
    CASE WHEN role_input = 'admin' THEN true ELSE false END
  )
  RETURNING id INTO new_user_id;

  SELECT json_build_object(
    'id', id,
    'username', username,
    'role', role,
    'created_at', created_at
  ) INTO new_user
  FROM users
  WHERE id = new_user_id;

  RETURN new_user;
END;
$$;


ALTER FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text", "display_name_input" "text" DEFAULT NULL::"text", "can_access_proofreading_input" boolean DEFAULT false, "can_access_spelling_input" boolean DEFAULT false, "can_access_learning_hub_input" boolean DEFAULT false) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp', 'extensions'
    AS $$
DECLARE
  new_user_id uuid;
  new_user json;
  final_display_name text;
  final_proofreading_access boolean;
  final_spelling_access boolean;
  final_learning_hub_access boolean;
BEGIN
  -- Use username as display_name if not provided or empty
  final_display_name := COALESCE(NULLIF(display_name_input, ''), username_input);

  -- If creating an admin, grant ALL permissions automatically
  IF role_input = 'admin' THEN
    final_proofreading_access := true;
    final_spelling_access := true;
    final_learning_hub_access := true;
  ELSE
    -- For regular users, use provided values or defaults
    final_proofreading_access := can_access_proofreading_input;
    final_spelling_access := can_access_spelling_input;
    final_learning_hub_access := can_access_learning_hub_input;
  END IF;

  INSERT INTO users (
    username,
    password_hash,
    role,
    display_name,
    can_access_proofreading,
    can_access_spelling,
    can_access_learning_hub
  )
  VALUES (
    username_input,
    crypt(password_input, gen_salt('bf')),
    role_input,
    final_display_name,
    final_proofreading_access,
    final_spelling_access,
    final_learning_hub_access
  )
  RETURNING id INTO new_user_id;

  SELECT json_build_object(
    'id', id,
    'username', username,
    'role', role,
    'display_name', display_name,
    'can_access_proofreading', can_access_proofreading,
    'can_access_spelling', can_access_spelling,
    'can_access_learning_hub', can_access_learning_hub,
    'created_at', created_at
  ) INTO new_user
  FROM users
  WHERE id = new_user_id;

  RETURN new_user;
END;
$$;


ALTER FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text", "display_name_input" "text", "can_access_proofreading_input" boolean, "can_access_spelling_input" boolean, "can_access_learning_hub_input" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text" DEFAULT 'user'::"text", "display_name_input" "text" DEFAULT NULL::"text", "can_access_proofreading_input" boolean DEFAULT false, "can_access_spelling_input" boolean DEFAULT false, "can_access_learning_hub_input" boolean DEFAULT false, "class_input" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  new_user_id uuid;
  new_user json;
BEGIN
  IF role_input = 'admin' THEN
    INSERT INTO users (username, password_hash, role, display_name, can_access_proofreading, can_access_spelling, can_access_learning_hub, class)
    VALUES (
      username_input,
      crypt(password_input, gen_salt('bf')),
      role_input,
      COALESCE(display_name_input, username_input),
      true,
      true,
      true,
      class_input
    )
    RETURNING id INTO new_user_id;
  ELSE
    INSERT INTO users (username, password_hash, role, display_name, can_access_proofreading, can_access_spelling, can_access_learning_hub, class)
    VALUES (
      username_input,
      crypt(password_input, gen_salt('bf')),
      role_input,
      COALESCE(display_name_input, username_input),
      can_access_proofreading_input,
      can_access_spelling_input,
      can_access_learning_hub_input,
      class_input
    )
    RETURNING id INTO new_user_id;
  END IF;

  SELECT json_build_object(
    'id', id,
    'username', username,
    'role', role,
    'display_name', display_name,
    'can_access_proofreading', can_access_proofreading,
    'can_access_spelling', can_access_spelling,
    'can_access_learning_hub', can_access_learning_hub,
    'class', class,
    'created_at', created_at
  ) INTO new_user
  FROM users
  WHERE id = new_user_id;

  RETURN new_user;
END;
$$;


ALTER FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text", "display_name_input" "text", "can_access_proofreading_input" boolean, "can_access_spelling_input" boolean, "can_access_learning_hub_input" boolean, "class_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_session"("session_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM sessions WHERE id = session_id;
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."delete_session"("session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_assignments_admin_view"("filter_type" "text" DEFAULT NULL::"text", "filter_status" "text" DEFAULT NULL::"text", "filter_student_id" "uuid" DEFAULT NULL::"uuid", "sort_by" "text" DEFAULT 'assigned_at'::"text", "sort_order" "text" DEFAULT 'desc'::"text") RETURNS TABLE("assignment_id" "uuid", "assignment_type" "text", "student_id" "uuid", "student_username" "text", "student_display_name" "text", "title" "text", "assigned_at" timestamp with time zone, "assigned_by_username" "text", "due_date" timestamp with time zone, "completed" boolean, "completed_at" timestamp with time zone, "is_overdue" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH all_assignments AS (
    -- Memorization assignments
    SELECT 
      ma.id as assignment_id,
      'memorization'::text as assignment_type,
      ma.user_id as student_id,
      u.username as student_username,
      COALESCE(u.display_name, u.username) as student_display_name,
      sc.title as title,
      ma.assigned_at,
      au.username as assigned_by_username,
      ma.due_date,
      ma.completed,
      ma.completed_at,
      (ma.completed = false AND ma.due_date < now()) as is_overdue
    FROM memorization_assignments ma
    JOIN users u ON ma.user_id = u.id
    JOIN saved_contents sc ON ma.content_id = sc.id
    LEFT JOIN users au ON ma.assigned_by = au.id
    
    UNION ALL
    
    -- Spelling assignments
    SELECT 
      pa.id as assignment_id,
      'spelling'::text as assignment_type,
      pa.user_id as student_id,
      u.username as student_username,
      COALESCE(u.display_name, u.username) as student_display_name,
      sp.title as title,
      pa.assigned_at,
      au.username as assigned_by_username,
      pa.due_date,
      COALESCE(pa.completed, false) as completed,
      pa.completed_at,
      (COALESCE(pa.completed, false) = false AND pa.due_date < now()) as is_overdue
    FROM practice_assignments pa
    JOIN users u ON pa.user_id = u.id
    JOIN spelling_practices sp ON pa.practice_id = sp.id
    LEFT JOIN users au ON pa.assigned_by = au.id
    
    UNION ALL
    
    -- Proofreading assignments
    SELECT 
      ppa.id as assignment_id,
      'proofreading'::text as assignment_type,
      ppa.user_id as student_id,
      u.username as student_username,
      COALESCE(u.display_name, u.username) as student_display_name,
      pp.title as title,
      ppa.assigned_at,
      au.username as assigned_by_username,
      ppa.due_date,
      ppa.completed,
      ppa.completed_at,
      (ppa.completed = false AND ppa.due_date < now()) as is_overdue
    FROM proofreading_practice_assignments ppa
    JOIN users u ON ppa.user_id = u.id
    JOIN proofreading_practices pp ON ppa.practice_id = pp.id
    LEFT JOIN users au ON ppa.assigned_by = au.id
  )
  SELECT * FROM all_assignments
  WHERE 
    (filter_type IS NULL OR assignment_type = filter_type)
    AND (filter_status IS NULL OR 
      (filter_status = 'completed' AND completed = true) OR
      (filter_status = 'in_progress' AND completed = false AND (due_date IS NULL OR due_date >= now())) OR
      (filter_status = 'overdue' AND completed = false AND due_date < now()))
    AND (filter_student_id IS NULL OR student_id = filter_student_id)
  ORDER BY
    CASE WHEN sort_by = 'assigned_at' AND sort_order = 'asc' THEN assigned_at END ASC,
    CASE WHEN sort_by = 'assigned_at' AND sort_order = 'desc' THEN assigned_at END DESC,
    CASE WHEN sort_by = 'due_date' AND sort_order = 'asc' THEN due_date END ASC NULLS LAST,
    CASE WHEN sort_by = 'due_date' AND sort_order = 'desc' THEN due_date END DESC NULLS LAST,
    CASE WHEN sort_by = 'student_name' AND sort_order = 'asc' THEN student_display_name END ASC,
    CASE WHEN sort_by = 'student_name' AND sort_order = 'desc' THEN student_display_name END DESC;
END;
$$;


ALTER FUNCTION "public"."get_all_assignments_admin_view"("filter_type" "text", "filter_status" "text", "filter_student_id" "uuid", "sort_by" "text", "sort_order" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_assignments_overview"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'memorization', (
      SELECT json_build_object(
        'total', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE completed = true),
        'in_progress', COUNT(*) FILTER (WHERE completed = false),
        'overdue', COUNT(*) FILTER (WHERE completed = false AND due_date < now()),
        'completion_rate', CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE completed = true)::numeric / COUNT(*)::numeric) * 100, 1)
          ELSE 0
        END
      )
      FROM memorization_assignments
    ),
    'spelling', (
      SELECT json_build_object(
        'total', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE completed = true),
        'in_progress', COUNT(*) FILTER (WHERE completed = false),
        'overdue', COUNT(*) FILTER (WHERE completed = false AND due_date < now()),
        'completion_rate', CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE completed = true)::numeric / COUNT(*)::numeric) * 100, 1)
          ELSE 0
        END
      )
      FROM practice_assignments
    ),
    'proofreading', (
      SELECT json_build_object(
        'total', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE completed = true),
        'in_progress', COUNT(*) FILTER (WHERE completed = false),
        'overdue', COUNT(*) FILTER (WHERE completed = false AND due_date < now()),
        'completion_rate', CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE completed = true)::numeric / COUNT(*)::numeric) * 100, 1)
          ELSE 0
        END
      )
      FROM proofreading_practice_assignments
    ),
    'total_across_all_types', (
      SELECT json_build_object(
        'total', (
          (SELECT COUNT(*) FROM memorization_assignments) +
          (SELECT COUNT(*) FROM practice_assignments) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments)
        ),
        'completed', (
          (SELECT COUNT(*) FROM memorization_assignments WHERE completed = true) +
          (SELECT COUNT(*) FROM practice_assignments WHERE completed = true) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments WHERE completed = true)
        ),
        'in_progress', (
          (SELECT COUNT(*) FROM memorization_assignments WHERE completed = false) +
          (SELECT COUNT(*) FROM practice_assignments WHERE completed = false) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments WHERE completed = false)
        ),
        'overdue', (
          (SELECT COUNT(*) FROM memorization_assignments WHERE completed = false AND due_date < now()) +
          (SELECT COUNT(*) FROM practice_assignments WHERE completed = false AND due_date < now()) +
          (SELECT COUNT(*) FROM proofreading_practice_assignments WHERE completed = false AND due_date < now())
        )
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_all_assignments_overview"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_students_performance"() RETURNS TABLE("user_id" "uuid", "username" "text", "display_name" "text", "spelling_practices" bigint, "spelling_avg_accuracy" numeric, "proofreading_practices" bigint, "proofreading_avg_accuracy" numeric, "memorization_sessions" bigint, "total_practices" bigint, "overall_avg_accuracy" numeric, "last_activity" timestamp with time zone, "total_time_minutes" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    u.id AS user_id,
    u.username,
    COALESCE(u.display_name, u.username) AS display_name,
    COALESCE(spelling_stats.practice_count, 0) AS spelling_practices,
    COALESCE(spelling_stats.avg_accuracy, 0) AS spelling_avg_accuracy,
    COALESCE(proofreading_stats.practice_count, 0) AS proofreading_practices,
    COALESCE(proofreading_stats.avg_accuracy, 0) AS proofreading_avg_accuracy,
    COALESCE(memorization_stats.session_count, 0) AS memorization_sessions,
    COALESCE(spelling_stats.practice_count, 0) + COALESCE(proofreading_stats.practice_count, 0) + COALESCE(memorization_stats.session_count, 0) AS total_practices,
    COALESCE(
      ROUND(
        (COALESCE(spelling_stats.avg_accuracy, 0) * COALESCE(spelling_stats.practice_count, 0) +
         COALESCE(proofreading_stats.avg_accuracy, 0) * COALESCE(proofreading_stats.practice_count, 0)) /
        NULLIF(COALESCE(spelling_stats.practice_count, 0) + COALESCE(proofreading_stats.practice_count, 0), 0),
        1
      ),
      0
    ) AS overall_avg_accuracy,
    GREATEST(
      spelling_stats.last_practice,
      proofreading_stats.last_practice,
      memorization_stats.last_session
    ) AS last_activity,
    COALESCE(spelling_stats.total_time, 0) + COALESCE(proofreading_stats.total_time, 0) + COALESCE(memorization_stats.total_time, 0) AS total_time_minutes
  FROM users u
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS practice_count,
      ROUND(AVG(accuracy_percentage), 1) AS avg_accuracy,
      MAX(completed_at) AS last_practice,
      ROUND(SUM(time_spent_seconds) / 60.0) AS total_time
    FROM spelling_practice_results
    GROUP BY user_id
  ) AS spelling_stats ON u.id = spelling_stats.user_id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS practice_count,
      ROUND(AVG(accuracy_percentage), 1) AS avg_accuracy,
      MAX(completed_at) AS last_practice,
      ROUND(SUM(time_spent_seconds) / 60.0) AS total_time
    FROM proofreading_practice_results
    GROUP BY user_id
  ) AS proofreading_stats ON u.id = proofreading_stats.user_id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS session_count,
      MAX(completed_at) AS last_session,
      ROUND(SUM(session_duration_seconds) / 60.0) AS total_time
    FROM memorization_practice_sessions
    GROUP BY user_id
  ) AS memorization_stats ON u.id = memorization_stats.user_id
  WHERE u.role = 'user'
  ORDER BY total_practices DESC, overall_avg_accuracy DESC;
$$;


ALTER FUNCTION "public"."get_all_students_performance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_class_analytics_summary"("date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  result jsonb;
  total_students int;
  active_students int;
BEGIN
  -- Get student counts
  SELECT COUNT(*) INTO total_students FROM users WHERE role = 'user';

  SELECT COUNT(DISTINCT user_id) INTO active_students
  FROM (
    SELECT user_id FROM spelling_practice_results
    WHERE (date_from IS NULL OR completed_at >= date_from)
      AND (date_to IS NULL OR completed_at <= date_to)
    UNION
    SELECT user_id FROM proofreading_practice_results
    WHERE (date_from IS NULL OR completed_at >= date_from)
      AND (date_to IS NULL OR completed_at <= date_to)
    UNION
    SELECT user_id FROM memorization_practice_sessions
    WHERE (date_from IS NULL OR completed_at >= date_from)
      AND (date_to IS NULL OR completed_at <= date_to)
  ) AS active_users;

  SELECT jsonb_build_object(
    'total_students', total_students,
    'active_students', active_students,
    'inactive_students', total_students - active_students,
    'spelling', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'unique_students', COUNT(DISTINCT user_id),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0),
        'median_accuracy', COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY accuracy_percentage), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0),
        'worst_score', COALESCE(MIN(accuracy_percentage), 0),
        'total_time_hours', COALESCE(ROUND(SUM(time_spent_seconds) / 3600.0, 1), 0),
        'avg_time_minutes', COALESCE(ROUND(AVG(time_spent_seconds) / 60.0, 1), 0),
        'score_distribution', (
          SELECT jsonb_build_object(
            'excellent', COUNT(*) FILTER (WHERE accuracy_percentage >= 90),
            'good', COUNT(*) FILTER (WHERE accuracy_percentage >= 70 AND accuracy_percentage < 90),
            'needs_improvement', COUNT(*) FILTER (WHERE accuracy_percentage < 70)
          )
          FROM spelling_practice_results
          WHERE (date_from IS NULL OR completed_at >= date_from)
            AND (date_to IS NULL OR completed_at <= date_to)
        )
      )
      FROM spelling_practice_results
      WHERE (date_from IS NULL OR completed_at >= date_from)
        AND (date_to IS NULL OR completed_at <= date_to)
    ),
    'proofreading', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'unique_students', COUNT(DISTINCT user_id),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0),
        'median_accuracy', COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY accuracy_percentage), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0),
        'worst_score', COALESCE(MIN(accuracy_percentage), 0),
        'total_time_hours', COALESCE(ROUND(SUM(time_spent_seconds) / 3600.0, 1), 0),
        'avg_time_minutes', COALESCE(ROUND(AVG(time_spent_seconds) / 60.0, 1), 0),
        'score_distribution', (
          SELECT jsonb_build_object(
            'excellent', COUNT(*) FILTER (WHERE accuracy_percentage >= 90),
            'good', COUNT(*) FILTER (WHERE accuracy_percentage >= 70 AND accuracy_percentage < 90),
            'needs_improvement', COUNT(*) FILTER (WHERE accuracy_percentage < 70)
          )
          FROM proofreading_practice_results
          WHERE (date_from IS NULL OR completed_at >= date_from)
            AND (date_to IS NULL OR completed_at <= date_to)
        )
      )
      FROM proofreading_practice_results
      WHERE (date_from IS NULL OR completed_at >= date_from)
        AND (date_to IS NULL OR completed_at <= date_to)
    ),
    'memorization', (
      SELECT jsonb_build_object(
        'total_sessions', COUNT(*),
        'unique_students', COUNT(DISTINCT user_id),
        'total_words_practiced', COALESCE(SUM(total_words), 0),
        'avg_words_per_session', COALESCE(ROUND(AVG(total_words), 1), 0),
        'total_time_hours', COALESCE(ROUND(SUM(session_duration_seconds) / 3600.0, 1), 0),
        'avg_time_minutes', COALESCE(ROUND(AVG(session_duration_seconds) / 60.0, 1), 0)
      )
      FROM memorization_practice_sessions
      WHERE (date_from IS NULL OR completed_at >= date_from)
        AND (date_to IS NULL OR completed_at <= date_to)
    )
  ) INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_class_analytics_summary"("date_from" timestamp with time zone, "date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_memorization_assignment_stats"("target_content_id" "uuid") RETURNS TABLE("total_assigned" bigint, "total_completed" bigint, "completion_rate" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    COUNT(*) AS total_assigned,
    COUNT(*) FILTER (WHERE completed = true) AS total_completed,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE completed = true)::numeric / COUNT(*)::numeric) * 100, 1)
      ELSE 0
    END AS completion_rate
  FROM memorization_assignments
  WHERE content_id = target_content_id;
$$;


ALTER FUNCTION "public"."get_memorization_assignment_stats"("target_content_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_overdue_assignments"() RETURNS TABLE("assignment_id" "uuid", "assignment_type" "text", "student_id" "uuid", "student_username" "text", "student_display_name" "text", "title" "text", "due_date" timestamp with time zone, "days_overdue" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH overdue AS (
    -- Memorization
    SELECT 
      ma.id,
      'memorization'::text,
      ma.user_id,
      u.username,
      COALESCE(u.display_name, u.username),
      sc.title,
      ma.due_date,
      EXTRACT(DAY FROM (now() - ma.due_date))::integer
    FROM memorization_assignments ma
    JOIN users u ON ma.user_id = u.id
    JOIN saved_contents sc ON ma.content_id = sc.id
    WHERE ma.completed = false AND ma.due_date < now()
    
    UNION ALL
    
    -- Spelling
    SELECT 
      pa.id,
      'spelling'::text,
      pa.user_id,
      u.username,
      COALESCE(u.display_name, u.username),
      sp.title,
      pa.due_date,
      EXTRACT(DAY FROM (now() - pa.due_date))::integer
    FROM practice_assignments pa
    JOIN users u ON pa.user_id = u.id
    JOIN spelling_practices sp ON pa.practice_id = sp.id
    WHERE COALESCE(pa.completed, false) = false AND pa.due_date < now()
    
    UNION ALL
    
    -- Proofreading
    SELECT 
      ppa.id,
      'proofreading'::text,
      ppa.user_id,
      u.username,
      COALESCE(u.display_name, u.username),
      pp.title,
      ppa.due_date,
      EXTRACT(DAY FROM (now() - ppa.due_date))::integer
    FROM proofreading_practice_assignments ppa
    JOIN users u ON ppa.user_id = u.id
    JOIN proofreading_practices pp ON ppa.practice_id = pp.id
    WHERE ppa.completed = false AND ppa.due_date < now()
  )
  SELECT * FROM overdue
  ORDER BY due_date ASC;
END;
$$;


ALTER FUNCTION "public"."get_overdue_assignments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_performance_distribution"("practice_type" "text" DEFAULT 'spelling'::"text") RETURNS TABLE("score_range" "text", "student_count" bigint, "percentage" numeric)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  total_students bigint;
BEGIN
  IF practice_type = 'spelling' THEN
    SELECT COUNT(DISTINCT user_id) INTO total_students FROM spelling_practice_results;

    RETURN QUERY
    WITH student_averages AS (
      SELECT
        user_id,
        ROUND(AVG(accuracy_percentage)) AS avg_score
      FROM spelling_practice_results
      GROUP BY user_id
    )
    SELECT
      score_range,
      count,
      ROUND((count::numeric / NULLIF(total_students, 0)) * 100, 1) AS percentage
    FROM (
      SELECT '90-100' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 90
      UNION ALL
      SELECT '80-89' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 80 AND avg_score < 90
      UNION ALL
      SELECT '70-79' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 70 AND avg_score < 80
      UNION ALL
      SELECT '60-69' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 60 AND avg_score < 70
      UNION ALL
      SELECT '0-59' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score < 60
    ) ranges
    ORDER BY
      CASE score_range
        WHEN '90-100' THEN 1
        WHEN '80-89' THEN 2
        WHEN '70-79' THEN 3
        WHEN '60-69' THEN 4
        WHEN '0-59' THEN 5
      END;
  ELSIF practice_type = 'proofreading' THEN
    SELECT COUNT(DISTINCT user_id) INTO total_students FROM proofreading_practice_results;

    RETURN QUERY
    WITH student_averages AS (
      SELECT
        user_id,
        ROUND(AVG(accuracy_percentage)) AS avg_score
      FROM proofreading_practice_results
      GROUP BY user_id
    )
    SELECT
      score_range,
      count,
      ROUND((count::numeric / NULLIF(total_students, 0)) * 100, 1) AS percentage
    FROM (
      SELECT '90-100' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 90
      UNION ALL
      SELECT '80-89' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 80 AND avg_score < 90
      UNION ALL
      SELECT '70-79' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 70 AND avg_score < 80
      UNION ALL
      SELECT '60-69' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score >= 60 AND avg_score < 70
      UNION ALL
      SELECT '0-59' AS score_range, COUNT(*) AS count FROM student_averages WHERE avg_score < 60
    ) ranges
    ORDER BY
      CASE score_range
        WHEN '90-100' THEN 1
        WHEN '80-89' THEN 2
        WHEN '70-79' THEN 3
        WHEN '60-69' THEN 4
        WHEN '0-59' THEN 5
      END;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_performance_distribution"("practice_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_practice_activity_timeline"("days_back" integer DEFAULT 30) RETURNS TABLE("activity_date" "date", "spelling_count" bigint, "proofreading_count" bigint, "memorization_count" bigint, "total_count" bigint, "unique_students" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - days_back * INTERVAL '1 day',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::date AS activity_date
  )
  SELECT
    ds.activity_date,
    COALESCE(spelling.count, 0) AS spelling_count,
    COALESCE(proofreading.count, 0) AS proofreading_count,
    COALESCE(memorization.count, 0) AS memorization_count,
    COALESCE(spelling.count, 0) + COALESCE(proofreading.count, 0) + COALESCE(memorization.count, 0) AS total_count,
    COALESCE(
      GREATEST(
        COALESCE(spelling.unique_users, 0),
        COALESCE(proofreading.unique_users, 0),
        COALESCE(memorization.unique_users, 0)
      ),
      0
    ) AS unique_students
  FROM date_series ds
  LEFT JOIN (
    SELECT
      completed_at::date AS activity_date,
      COUNT(*) AS count,
      COUNT(DISTINCT user_id) AS unique_users
    FROM spelling_practice_results
    WHERE completed_at >= CURRENT_DATE - days_back * INTERVAL '1 day'
    GROUP BY completed_at::date
  ) spelling ON ds.activity_date = spelling.activity_date
  LEFT JOIN (
    SELECT
      completed_at::date AS activity_date,
      COUNT(*) AS count,
      COUNT(DISTINCT user_id) AS unique_users
    FROM proofreading_practice_results
    WHERE completed_at >= CURRENT_DATE - days_back * INTERVAL '1 day'
    GROUP BY completed_at::date
  ) proofreading ON ds.activity_date = proofreading.activity_date
  LEFT JOIN (
    SELECT
      completed_at::date AS activity_date,
      COUNT(*) AS count,
      COUNT(DISTINCT user_id) AS unique_users
    FROM memorization_practice_sessions
    WHERE completed_at >= CURRENT_DATE - days_back * INTERVAL '1 day'
    GROUP BY completed_at::date
  ) memorization ON ds.activity_date = memorization.activity_date
  ORDER BY ds.activity_date;
$$;


ALTER FUNCTION "public"."get_practice_activity_timeline"("days_back" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_proofreading_assignment_stats"("target_practice_id" "uuid") RETURNS TABLE("total_assigned" bigint, "total_completed" bigint, "completion_rate" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    COUNT(*) AS total_assigned,
    COUNT(*) FILTER (WHERE completed = true) AS total_completed,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE completed = true)::numeric / COUNT(*)::numeric) * 100, 1)
      ELSE 0
    END AS completion_rate
  FROM proofreading_practice_assignments
  WHERE practice_id = target_practice_id;
$$;


ALTER FUNCTION "public"."get_proofreading_assignment_stats"("target_practice_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_proofreading_rankings"() RETURNS TABLE("user_id" "uuid", "username" "text", "total_practices" bigint, "average_accuracy" numeric, "rank" bigint, "class" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_proofreading_rankings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_activity"("limit_count" integer DEFAULT 20) RETURNS TABLE("activity_type" "text", "user_id" "uuid", "username" "text", "display_name" "text", "title" "text", "accuracy_percentage" integer, "completed_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH all_activities AS (
    SELECT
      'spelling' AS activity_type,
      spr.user_id,
      u.username,
      COALESCE(u.display_name, u.username) AS display_name,
      spr.title,
      spr.accuracy_percentage,
      spr.completed_at
    FROM spelling_practice_results spr
    JOIN users u ON spr.user_id = u.id

    UNION ALL

    SELECT
      'proofreading' AS activity_type,
      ppr.user_id,
      u.username,
      COALESCE(u.display_name, u.username) AS display_name,
      array_length(ppr.sentences, 1)::text || ' sentences' AS title,
      ppr.accuracy_percentage,
      ppr.completed_at
    FROM proofreading_practice_results ppr
    JOIN users u ON ppr.user_id = u.id

    UNION ALL

    SELECT
      'memorization' AS activity_type,
      mps.user_id,
      u.username,
      COALESCE(u.display_name, u.username) AS display_name,
      mps.title,
      NULL AS accuracy_percentage,
      mps.completed_at
    FROM memorization_practice_sessions mps
    JOIN users u ON mps.user_id = u.id
  )
  SELECT *
  FROM all_activities
  ORDER BY completed_at DESC
  LIMIT limit_count;
$$;


ALTER FUNCTION "public"."get_recent_activity"("limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recommended_voice"("p_accent_code" "text") RETURNS TABLE("voice_name" "text", "voice_uri" "text", "is_ios_native" boolean, "notes" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    rv.voice_name,
    rv.voice_uri,
    rv.is_ios_native,
    rv.notes
  FROM recommended_voices rv
  WHERE rv.accent_code = p_accent_code
  ORDER BY rv.priority DESC, rv.created_at ASC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_recommended_voice"("p_accent_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_spelling_rankings"() RETURNS TABLE("user_id" "uuid", "username" "text", "total_practices" bigint, "average_accuracy" numeric, "rank" bigint, "class" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_spelling_rankings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_student_assignments_unified"("target_user_id" "uuid") RETURNS TABLE("assignment_id" "uuid", "assignment_type" "text", "title" "text", "assigned_at" timestamp with time zone, "assigned_by_username" "text", "due_date" timestamp with time zone, "completed" boolean, "completed_at" timestamp with time zone, "is_overdue" boolean, "content_data" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH all_assignments AS (
    -- Memorization assignments
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
      ) as content_data
    FROM memorization_assignments ma
    JOIN saved_contents sc ON ma.content_id = sc.id
    LEFT JOIN users u ON ma.assigned_by = u.id
    WHERE ma.user_id = target_user_id
    
    UNION ALL
    
    -- Spelling assignments
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
      ) as content_data
    FROM practice_assignments pa
    JOIN spelling_practices sp ON pa.practice_id = sp.id
    LEFT JOIN users u ON pa.assigned_by = u.id
    WHERE pa.user_id = target_user_id
    
    UNION ALL
    
    -- Proofreading assignments
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
      ) as content_data
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
$$;


ALTER FUNCTION "public"."get_student_assignments_unified"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_student_detailed_analytics"("target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  result jsonb;
  class_avg_spelling numeric;
  class_avg_proofreading numeric;
BEGIN
  -- Get class averages for comparison
  SELECT COALESCE(ROUND(AVG(accuracy_percentage), 1), 0) INTO class_avg_spelling
  FROM spelling_practice_results;

  SELECT COALESCE(ROUND(AVG(accuracy_percentage), 1), 0) INTO class_avg_proofreading
  FROM proofreading_practice_results;

  SELECT jsonb_build_object(
    'user_info', (
      SELECT jsonb_build_object(
        'user_id', id,
        'username', username,
        'display_name', COALESCE(display_name, username)
      )
      FROM users WHERE id = target_user_id
    ),
    'spelling', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0),
        'class_average', class_avg_spelling,
        'compared_to_class', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0) - class_avg_spelling,
        'best_score', COALESCE(MAX(accuracy_percentage), 0),
        'worst_score', COALESCE(MIN(accuracy_percentage), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'recent_practices', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'title', title,
              'accuracy', accuracy_percentage,
              'completed_at', completed_at,
              'time_spent', time_spent_seconds
            ) ORDER BY completed_at DESC
          )
          FROM (
            SELECT title, accuracy_percentage, completed_at, time_spent_seconds
            FROM spelling_practice_results
            WHERE user_id = target_user_id
            ORDER BY completed_at DESC
            LIMIT 10
          ) recent
        ),
        'improvement_trend', (
          SELECT COALESCE(ROUND(AVG(accuracy_percentage) FILTER (WHERE completed_at >= NOW() - INTERVAL '7 days'), 1), 0) -
                 COALESCE(ROUND(AVG(accuracy_percentage) FILTER (WHERE completed_at < NOW() - INTERVAL '7 days'), 1), 0)
          FROM spelling_practice_results
          WHERE user_id = target_user_id
        )
      )
      FROM spelling_practice_results
      WHERE user_id = target_user_id
    ),
    'proofreading', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0),
        'class_average', class_avg_proofreading,
        'compared_to_class', COALESCE(ROUND(AVG(accuracy_percentage), 1), 0) - class_avg_proofreading,
        'best_score', COALESCE(MAX(accuracy_percentage), 0),
        'worst_score', COALESCE(MIN(accuracy_percentage), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'recent_practices', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'sentence_count', array_length(sentences, 1),
              'accuracy', accuracy_percentage,
              'completed_at', completed_at,
              'time_spent', time_spent_seconds
            ) ORDER BY completed_at DESC
          )
          FROM (
            SELECT sentences, accuracy_percentage, completed_at, time_spent_seconds
            FROM proofreading_practice_results
            WHERE user_id = target_user_id
            ORDER BY completed_at DESC
            LIMIT 10
          ) recent
        ),
        'improvement_trend', (
          SELECT COALESCE(ROUND(AVG(accuracy_percentage) FILTER (WHERE completed_at >= NOW() - INTERVAL '7 days'), 1), 0) -
                 COALESCE(ROUND(AVG(accuracy_percentage) FILTER (WHERE completed_at < NOW() - INTERVAL '7 days'), 1), 0)
          FROM proofreading_practice_results
          WHERE user_id = target_user_id
        )
      )
      FROM proofreading_practice_results
      WHERE user_id = target_user_id
    ),
    'memorization', (
      SELECT jsonb_build_object(
        'total_sessions', COUNT(*),
        'total_words_practiced', COALESCE(SUM(total_words), 0),
        'avg_words_per_session', COALESCE(ROUND(AVG(total_words), 1), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(session_duration_seconds) / 60.0), 0),
        'recent_sessions', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'title', title,
              'total_words', total_words,
              'hidden_words', hidden_words_count,
              'completed_at', completed_at,
              'duration', session_duration_seconds
            ) ORDER BY completed_at DESC
          )
          FROM (
            SELECT title, total_words, hidden_words_count, completed_at, session_duration_seconds
            FROM memorization_practice_sessions
            WHERE user_id = target_user_id
            ORDER BY completed_at DESC
            LIMIT 10
          ) recent
        )
      )
      FROM memorization_practice_sessions
      WHERE user_id = target_user_id
    )
  ) INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_student_detailed_analytics"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_assigned_memorizations"("target_user_id" "uuid") RETURNS TABLE("id" "uuid", "content_id" "uuid", "title" "text", "original_text" "text", "selected_word_indices" "jsonb", "assigned_at" timestamp with time zone, "due_date" timestamp with time zone, "completed" boolean, "completed_at" timestamp with time zone, "assigned_by_username" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    ma.id,
    sc.id AS content_id,
    sc.title,
    sc.original_text,
    sc.selected_word_indices,
    ma.assigned_at,
    ma.due_date,
    ma.completed,
    ma.completed_at,
    u.username AS assigned_by_username
  FROM memorization_assignments ma
  JOIN saved_contents sc ON ma.content_id = sc.id
  JOIN users u ON ma.assigned_by = u.id
  WHERE ma.user_id = target_user_id
  ORDER BY
    CASE WHEN ma.completed THEN 1 ELSE 0 END,
    ma.due_date NULLS LAST,
    ma.assigned_at DESC;
$$;


ALTER FUNCTION "public"."get_user_assigned_memorizations"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_assigned_proofreading_practices"("target_user_id" "uuid") RETURNS TABLE("id" "uuid", "practice_id" "uuid", "title" "text", "sentences" "jsonb", "answers" "jsonb", "assigned_at" timestamp with time zone, "due_date" timestamp with time zone, "completed" boolean, "completed_at" timestamp with time zone, "assigned_by_username" "text", "result_id" "uuid", "accuracy_percentage" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    pa.id,
    pp.id AS practice_id,
    pp.title,
    pp.sentences,
    pp.answers,
    pa.assigned_at,
    pa.due_date,
    pa.completed,
    pa.completed_at,
    COALESCE(u.username, 'System') AS assigned_by_username,
    pr.id AS result_id,
    pr.accuracy_percentage
  FROM proofreading_practice_assignments pa
  JOIN proofreading_practices pp ON pa.practice_id = pp.id
  LEFT JOIN users u ON pa.assigned_by = u.id
  LEFT JOIN proofreading_practice_results pr ON pr.assignment_id = pa.id
  WHERE pa.user_id = target_user_id
  ORDER BY
    CASE WHEN pa.completed THEN 1 ELSE 0 END,
    pa.due_date NULLS LAST,
    pa.assigned_at DESC;
$$;


ALTER FUNCTION "public"."get_user_assigned_proofreading_practices"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_progress_summary"("target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'spelling', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage)), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0)
      )
      FROM spelling_practice_results
      WHERE user_id = target_user_id
    ),
    'proofreading', (
      SELECT jsonb_build_object(
        'total_practices', COUNT(*),
        'average_accuracy', COALESCE(ROUND(AVG(accuracy_percentage)), 0),
        'total_time_minutes', COALESCE(ROUND(SUM(time_spent_seconds) / 60.0), 0),
        'best_score', COALESCE(MAX(accuracy_percentage), 0)
      )
      FROM proofreading_practice_results
      WHERE user_id = target_user_id
    ),
    'memorization', (
      SELECT jsonb_build_object(
        'total_sessions', COUNT(*),
        'total_time_minutes', COALESCE(ROUND(SUM(session_duration_seconds) / 60.0), 0),
        'total_words_practiced', COALESCE(SUM(total_words), 0)
      )
      FROM memorization_practice_sessions
      WHERE user_id = target_user_id
    )
  ) INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_user_progress_summary"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_saved_contents_count"("user_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  content_count integer;
BEGIN
  SELECT COUNT(*)::integer
  INTO content_count
  FROM saved_contents
  WHERE user_id = user_uuid;

  RETURN COALESCE(content_count, 0);
END;
$$;


ALTER FUNCTION "public"."get_user_saved_contents_count"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_sessions"("user_id_input" "uuid") RETURNS TABLE("session_id" "uuid", "created_at" timestamp with time zone, "expires_at" timestamp with time zone, "last_validated" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_sessions"("user_id_input" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  INSERT INTO public.users (id, username, password_hash, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    'AUTH_MANAGED', -- Placeholder as authentications is handled by Supabase
    'user',
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  )
  ON CONFLICT (username) DO UPDATE SET 
    id = EXCLUDED.id,
    updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_student_record_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Only reverse if there was a coin impact and we have a student_id
    IF OLD.coin_amount != 0 AND OLD.student_id IS NOT NULL THEN
        UPDATE public.user_room_data
        SET coins = COALESCE(coins, 0) - OLD.coin_amount
        WHERE user_id = OLD.student_id;
    END IF;
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."handle_student_record_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_coins"("user_id" "uuid", "amount" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.users
  SET coins = coins + amount
  WHERE id = user_id;
END;
$$;


ALTER FUNCTION "public"."increment_coins"("user_id" "uuid", "amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_room_coins"("target_user_id" "uuid", "amount" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.user_room_data
  SET coins = COALESCE(coins, 0) + amount
  WHERE user_id = target_user_id;
  
  -- Logic to handle cases where user might not have a record yet could go here if needed
END;
$$;


ALTER FUNCTION "public"."increment_room_coins"("target_user_id" "uuid", "amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_room_coins"("target_user_id" "uuid", "amount" integer, "log_reason" "text" DEFAULT 'Gift'::"text", "log_admin_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    today_date_str TEXT;
    status_date DATE;
    current_counts JSONB;
    daily_usage INTEGER;
    daily_real_earned INTEGER;
    is_answering_question BOOLEAN;
    new_morning_status TEXT;
    is_virtual BOOLEAN := FALSE;
    final_amount INTEGER;
BEGIN
    -- Initialize variables
    -- HK time for resets
    today_date_str := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD');
    status_date := (now() AT TIME ZONE 'Asia/Hong_Kong')::DATE;
    is_answering_question := log_reason LIKE '%回答問題%';
    final_amount := amount;

    -- Ensure user has a record in user_room_data
    INSERT INTO public.user_room_data (user_id, coins, virtual_coins, daily_counts, morning_status, last_morning_update)
    VALUES (target_user_id, 0, 0, '{}'::jsonb, 'todo', status_date)
    ON CONFLICT (user_id) DO NOTHING;

    -- Get current counts and stats
    SELECT daily_counts, morning_status INTO current_counts, new_morning_status
    FROM public.user_room_data
    WHERE user_id = target_user_id;

    -- Initialize daily tracking
    IF (current_counts->>'date') = today_date_str THEN
        daily_usage := COALESCE((current_counts->>'count')::INTEGER, 0);
        daily_real_earned := COALESCE((current_counts->>'real_earned')::INTEGER, 0);
    ELSE
        daily_usage := 0;
        daily_real_earned := 0;
    END IF;

    -- Determine Morning Duties Status Update
    IF log_reason = '完成班務（交齊功課）' THEN
        new_morning_status := 'completed';
    ELSIF log_reason = '完成班務（欠功課）' THEN
        new_morning_status := 'review';
    ELSIF log_reason = '完成班務（寫手冊）' THEN
        new_morning_status := 'completed';
    ELSIF log_reason LIKE '%缺席%' OR log_reason ILIKE '%absent%' THEN
        new_morning_status := 'absent';
    END IF;

    -- Handle Reward Logic (Virtual vs Real)
    IF is_answering_question AND amount > 0 THEN
        IF daily_usage < 3 THEN
            -- Real Coins
            daily_real_earned := daily_real_earned + amount;
            UPDATE public.user_room_data
            SET coins = COALESCE(coins, 0) + final_amount,
                daily_counts = jsonb_build_object('date', today_date_str, 'count', daily_usage + 1, 'real_earned', daily_real_earned),
                morning_status = new_morning_status,
                last_morning_update = status_date,
                updated_at = NOW()
            WHERE user_id = target_user_id;
        ELSE
            -- Virtual Coins
            is_virtual := TRUE;
            UPDATE public.user_room_data
            SET virtual_coins = COALESCE(virtual_coins, 0) + final_amount,
                daily_counts = jsonb_build_object('date', today_date_str, 'count', daily_usage + 1, 'real_earned', daily_real_earned),
                morning_status = new_morning_status,
                last_morning_update = status_date,
                updated_at = NOW()
            WHERE user_id = target_user_id;
        END IF;
    ELSE
        -- Standard Coins update
        IF amount > 0 THEN
            daily_real_earned := daily_real_earned + amount;
        END IF;

        UPDATE public.user_room_data
        SET coins = COALESCE(coins, 0) + final_amount,
            daily_counts = jsonb_build_object('date', today_date_str, 'count', daily_usage, 'real_earned', daily_real_earned),
            morning_status = new_morning_status,
            last_morning_update = status_date,
            updated_at = NOW()
        WHERE user_id = target_user_id;
    END IF;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by)
    VALUES (
        target_user_id, 
        final_amount, 
        CASE WHEN is_virtual THEN log_reason || ' (Virtual)' ELSE log_reason END, 
        log_admin_id
    );
END;
$$;


ALTER FUNCTION "public"."increment_room_coins"("target_user_id" "uuid", "amount" integer, "log_reason" "text", "log_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = user_id AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_first_admin"("check_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp', 'extensions'
    AS $$
DECLARE
  first_admin_id uuid;
BEGIN
  -- Get the ID of the first admin created
  SELECT id INTO first_admin_id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;
  
  RETURN check_user_id = first_admin_id;
END;
$$;


ALTER FUNCTION "public"."is_first_admin"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_admin_password_reset_attempt"("reset_status" "text", "ip_addr" "inet" DEFAULT NULL::"inet") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO admin_password_reset_log (status, ip_address)
  VALUES (reset_status, ip_addr);
END;
$$;


ALTER FUNCTION "public"."log_admin_password_reset_attempt"("reset_status" "text", "ip_addr" "inet") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_assignment_complete"("p_assignment_id" "uuid", "p_assignment_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Update the appropriate assignment table based on type
  IF p_assignment_type = 'spelling' THEN
    UPDATE practice_assignments
    SET 
      completed = true,
      completed_at = now()
    WHERE id = p_assignment_id
      AND user_id = v_user_id
      AND (completed = false OR completed IS NULL);
      
  ELSIF p_assignment_type = 'memorization' THEN
    UPDATE memorization_assignments
    SET 
      completed = true,
      completed_at = now()
    WHERE id = p_assignment_id
      AND user_id = v_user_id
      AND (completed = false OR completed IS NULL);
      
  ELSIF p_assignment_type = 'proofreading' THEN
    UPDATE proofreading_practice_assignments
    SET 
      completed = true,
      completed_at = now()
    WHERE id = p_assignment_id
      AND user_id = v_user_id
      AND (completed = false OR completed IS NULL);
      
  ELSE
    RAISE EXCEPTION 'Invalid assignment type: %', p_assignment_type;
  END IF;

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_assignment_complete"("p_assignment_id" "uuid", "p_assignment_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_spelling_assignment_complete"("target_assignment_id" "uuid", "target_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  result json;
  rows_updated integer;
BEGIN
  UPDATE practice_assignments
  SET 
    completed = true,
    completed_at = now(),
    updated_at = now()
  WHERE id = target_assignment_id
    AND user_id = target_user_id
    AND completed = false;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  IF rows_updated > 0 THEN
    result := json_build_object(
      'success', true,
      'message', 'Assignment marked as complete'
    );
  ELSE
    result := json_build_object(
      'success', false,
      'message', 'Assignment not found or already completed'
    );
  END IF;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."mark_spelling_assignment_complete"("target_assignment_id" "uuid", "target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_admin_password"("verification_code" "text", "new_password" "text" DEFAULT '64165644'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  admin_user_id uuid;
  code_valid boolean;
BEGIN
  -- Verify the system code
  SELECT verify_system_code(verification_code) INTO code_valid;
  
  IF NOT code_valid THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid verification code'
    );
  END IF;
  
  -- Get admin user ID
  SELECT id INTO admin_user_id
  FROM users
  WHERE username = 'admin' AND role = 'admin'
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin user not found'
    );
  END IF;
  
  -- Reset the password
  UPDATE users
  SET 
    password_hash = extensions.crypt(new_password, extensions.gen_salt('bf')),
    force_password_change = false,
    updated_at = now()
  WHERE id = admin_user_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Admin password has been reset',
    'username', 'admin',
    'new_password', new_password
  );
END;
$$;


ALTER FUNCTION "public"."reset_admin_password"("verification_code" "text", "new_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_admin_password_by_code"("reset_code" "text", "new_password" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  result json;
  code_matches boolean;
  stored_hash text;
BEGIN
  -- Get the stored hash (function has SECURITY DEFINER so it can access)
  SELECT code_hash INTO stored_hash FROM admin_reset_code_store LIMIT 1;
  
  IF stored_hash IS NULL THEN
    result := json_build_object(
      'success', false,
      'message', 'Reset code not configured'
    );
    INSERT INTO admin_password_reset_log (status) VALUES ('error_no_code');
    RETURN result;
  END IF;
  
  -- Verify the code against the stored hash
  code_matches := extensions.crypt(reset_code, stored_hash) = stored_hash;
  
  IF NOT code_matches THEN
    INSERT INTO admin_password_reset_log (status) VALUES ('failed_invalid_code');
    result := json_build_object(
      'success', false,
      'message', 'Invalid reset code'
    );
    RETURN result;
  END IF;
  
  -- Validate new password length
  IF LENGTH(new_password) < 6 THEN
    result := json_build_object(
      'success', false,
      'message', 'Password must be at least 6 characters'
    );
    RETURN result;
  END IF;
  
  -- Update the admin user password in auth.users
  UPDATE auth.users
  SET 
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    updated_at = now()
  WHERE email = 'admin@example.com';
  
  INSERT INTO admin_password_reset_log (status) VALUES ('success');
  
  result := json_build_object(
    'success', true,
    'message', 'Admin password has been reset successfully'
  );
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."reset_admin_password_by_code"("reset_code" "text", "new_password" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_all_coins"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- 1. Zero out all user balances in user_room_data
    UPDATE public.user_room_data
    SET coins = 0,
        updated_at = NOW();

    -- 2. Clear all transaction history from coin_transactions
    -- This removes mistaken records entirely as requested
    DELETE FROM public.coin_transactions;
END;
$$;


ALTER FUNCTION "public"."reset_all_coins"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revert_coin_transaction"("transaction_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    target_user UUID;
    coin_amt INTEGER;
BEGIN
    -- Get transaction info
    SELECT user_id, amount INTO target_user, coin_amt
    FROM public.coin_transactions
    WHERE id = transaction_id;

    IF FOUND THEN
        -- Subtract the awarded amount (negative of amount)
        UPDATE public.user_room_data
        SET coins = COALESCE(coins, 0) - coin_amt,
            updated_at = NOW()
        WHERE user_id = target_user;

        -- Delete the transaction
        DELETE FROM public.coin_transactions WHERE id = transaction_id;
    END IF;
END;
$$;


ALTER FUNCTION "public"."revert_coin_transaction"("transaction_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_system_health_check"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  health_report json;
  test_results json[] := ARRAY[]::json[];
  test_hash text;
  test_verify boolean;
  test_user_id uuid;
  overall_status text := 'HEALTHY';
BEGIN
  -- Test 1: Check if pgcrypto extension is accessible
  BEGIN
    SELECT extensions.gen_salt('bf') INTO test_hash;
    test_results := array_append(test_results, json_build_object(
      'test', 'pgcrypto_extension_access',
      'status', 'PASS',
      'message', 'pgcrypto extension is accessible'
    ));
  EXCEPTION WHEN OTHERS THEN
    overall_status := 'CRITICAL';
    test_results := array_append(test_results, json_build_object(
      'test', 'pgcrypto_extension_access',
      'status', 'FAIL',
      'message', 'Cannot access pgcrypto extension: ' || SQLERRM
    ));
  END;

  -- Test 2: Check if password hashing works
  BEGIN
    test_hash := extensions.crypt('test_password', extensions.gen_salt('bf'));
    IF test_hash IS NOT NULL AND length(test_hash) > 20 THEN
      test_results := array_append(test_results, json_build_object(
        'test', 'password_hashing',
        'status', 'PASS',
        'message', 'Password hashing is working'
      ));
    ELSE
      overall_status := 'CRITICAL';
      test_results := array_append(test_results, json_build_object(
        'test', 'password_hashing',
        'status', 'FAIL',
        'message', 'Password hash generation returned invalid result'
      ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    overall_status := 'CRITICAL';
    test_results := array_append(test_results, json_build_object(
      'test', 'password_hashing',
      'status', 'FAIL',
      'message', 'Password hashing failed: ' || SQLERRM
    ));
  END;

  -- Test 3: Check if password verification works
  BEGIN
    test_verify := (test_hash = extensions.crypt('test_password', test_hash));
    IF test_verify THEN
      test_results := array_append(test_results, json_build_object(
        'test', 'password_verification',
        'status', 'PASS',
        'message', 'Password verification is working'
      ));
    ELSE
      overall_status := 'CRITICAL';
      test_results := array_append(test_results, json_build_object(
        'test', 'password_verification',
        'status', 'FAIL',
        'message', 'Password verification returned false for matching passwords'
      ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    overall_status := 'CRITICAL';
    test_results := array_append(test_results, json_build_object(
      'test', 'password_verification',
      'status', 'FAIL',
      'message', 'Password verification failed: ' || SQLERRM
    ));
  END;

  -- Test 4: Check if verify_password function works
  BEGIN
    -- Use the admin user for testing
    SELECT id INTO test_user_id FROM users WHERE username = 'admin' AND role = 'admin' LIMIT 1;
    IF test_user_id IS NOT NULL THEN
      -- We can't test with the actual password, but we can test that the function executes
      PERFORM verify_password(test_user_id, 'dummy_test_password');
      test_results := array_append(test_results, json_build_object(
        'test', 'verify_password_function',
        'status', 'PASS',
        'message', 'verify_password function executes without errors'
      ));
    ELSE
      IF overall_status = 'HEALTHY' THEN overall_status := 'WARNING'; END IF;
      test_results := array_append(test_results, json_build_object(
        'test', 'verify_password_function',
        'status', 'WARNING',
        'message', 'No admin user found to test verify_password function'
      ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    overall_status := 'CRITICAL';
    test_results := array_append(test_results, json_build_object(
      'test', 'verify_password_function',
      'status', 'FAIL',
      'message', 'verify_password function failed: ' || SQLERRM
    ));
  END;

  -- Test 5: Check if verify_system_code function works
  BEGIN
    PERFORM verify_system_code('dummy_code');
    test_results := array_append(test_results, json_build_object(
      'test', 'verify_system_code_function',
      'status', 'PASS',
      'message', 'verify_system_code function executes without errors'
    ));
  EXCEPTION WHEN OTHERS THEN
    overall_status := 'CRITICAL';
    test_results := array_append(test_results, json_build_object(
      'test', 'verify_system_code_function',
      'status', 'FAIL',
      'message', 'verify_system_code function failed: ' || SQLERRM
    ));
  END;

  -- Test 6: Check if admin user exists
  BEGIN
    SELECT id INTO test_user_id FROM users WHERE username = 'admin' AND role = 'admin' LIMIT 1;
    IF test_user_id IS NOT NULL THEN
      test_results := array_append(test_results, json_build_object(
        'test', 'admin_user_exists',
        'status', 'PASS',
        'message', 'Admin user exists in database'
      ));
    ELSE
      IF overall_status = 'HEALTHY' THEN overall_status := 'WARNING'; END IF;
      test_results := array_append(test_results, json_build_object(
        'test', 'admin_user_exists',
        'status', 'WARNING',
        'message', 'No admin user found in database'
      ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF overall_status = 'HEALTHY' THEN overall_status := 'WARNING'; END IF;
    test_results := array_append(test_results, json_build_object(
      'test', 'admin_user_exists',
      'status', 'WARNING',
      'message', 'Could not check for admin user: ' || SQLERRM
    ));
  END;

  -- Build final health report
  health_report := json_build_object(
    'overall_status', overall_status,
    'timestamp', now(),
    'tests_run', array_length(test_results, 1),
    'test_results', test_results
  );

  RETURN health_report;
END;
$$;


ALTER FUNCTION "public"."run_system_health_check"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_content_reference_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_content_reference_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_dev_error_log_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_dev_error_log_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text" DEFAULT NULL::"text", "new_display_name" "text" DEFAULT NULL::"text", "new_role" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp', 'extensions'
    AS $$
DECLARE
  updated_user json;
  first_admin_id uuid;
BEGIN
  -- Check if caller is the first admin
  IF NOT is_first_admin(caller_user_id) THEN
    RAISE EXCEPTION 'Only the super admin can update user information';
  END IF;

  -- Get the first admin ID
  SELECT id INTO first_admin_id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Prevent changing the super admin's role
  IF target_user_id = first_admin_id AND new_role IS NOT NULL AND new_role != 'admin' THEN
    RAISE EXCEPTION 'Cannot change super admin role';
  END IF;

  -- Update the user
  UPDATE users
  SET
    username = COALESCE(new_username, username),
    display_name = COALESCE(new_display_name, display_name),
    role = COALESCE(new_role, role)
  WHERE id = target_user_id;

  -- Return updated user info
  SELECT json_build_object(
    'id', id,
    'username', username,
    'role', role,
    'display_name', display_name,
    'can_access_proofreading', can_access_proofreading,
    'can_access_spelling', can_access_spelling,
    'can_access_learning_hub', can_access_learning_hub,
    'created_at', created_at
  ) INTO updated_user
  FROM users
  WHERE id = target_user_id;

  RETURN updated_user;
END;
$$;


ALTER FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text" DEFAULT NULL::"text", "new_display_name" "text" DEFAULT NULL::"text", "new_role" "text" DEFAULT NULL::"text", "new_class" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp', 'extensions'
    AS $$
DECLARE
  updated_user json;
  first_admin_id uuid;
BEGIN
  -- Check if caller is the first admin
  IF NOT is_first_admin(caller_user_id) THEN
    RAISE EXCEPTION 'Only the super admin can update user information';
  END IF;

  -- Get the first admin ID
  SELECT id INTO first_admin_id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Prevent changing the super admin's role
  IF target_user_id = first_admin_id AND new_role IS NOT NULL AND new_role != 'admin' THEN
    RAISE EXCEPTION 'Cannot change super admin role';
  END IF;

  -- Update the user
  UPDATE users
  SET
    username = COALESCE(new_username, username),
    display_name = COALESCE(new_display_name, display_name),
    role = COALESCE(new_role, role),
    class = CASE 
      WHEN new_class IS NOT NULL THEN new_class
      ELSE class
    END
  WHERE id = target_user_id;

  -- Return updated user info
  SELECT json_build_object(
    'id', id,
    'username', username,
    'role', role,
    'display_name', display_name,
    'can_access_proofreading', can_access_proofreading,
    'can_access_spelling', can_access_spelling,
    'can_access_learning_hub', can_access_learning_hub,
    'class', class,
    'created_at', created_at
  ) INTO updated_user
  FROM users
  WHERE id = target_user_id;

  RETURN updated_user;
END;
$$;


ALTER FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text", "new_class" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text" DEFAULT NULL::"text", "new_display_name" "text" DEFAULT NULL::"text", "new_role" "text" DEFAULT NULL::"text", "new_class" "text" DEFAULT NULL::"text", "new_seat_number" integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp', 'extensions'
    AS $$
DECLARE
  updated_user json;
  first_admin_id uuid;
  current_role text;
  current_seat_number integer;
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
    class = CASE WHEN new_class IS NOT NULL THEN new_class ELSE class END
  WHERE id = target_user_id;

  IF new_seat_number IS NOT NULL THEN
    UPDATE users SET seat_number = new_seat_number WHERE id = target_user_id;
    IF NOT FOUND THEN
      INSERT INTO users (id, seat_number, display_name, created_at)
      SELECT id, new_seat_number, display_name, created_at FROM users WHERE id = target_user_id;
    END IF;
  END IF;

  SELECT seat_number INTO current_seat_number FROM users WHERE id = target_user_id;

  SELECT json_build_object(
    'id', id, 'username', username, 'role', role, 'display_name', display_name, 'class', class, 'seat_number', current_seat_number, 'created_at', created_at
  ) INTO updated_user FROM users WHERE id = target_user_id;

  RETURN updated_user;
END;
$$;


ALTER FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text", "new_class" "text", "new_seat_number" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_session"("session_id" "uuid") RETURNS TABLE("is_valid" boolean, "user_id" "uuid", "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."validate_session"("session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_password"("user_id" "uuid", "password_input" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM users
  WHERE id = user_id;
  
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN stored_hash = crypt(password_input, stored_hash);
END;
$$;


ALTER FUNCTION "public"."verify_password"("user_id" "uuid", "password_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_system_code"("code_input" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT value INTO stored_hash
  FROM system_config
  WHERE key = 'verification_code';
  
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN stored_hash = crypt(code_input, stored_hash);
END;
$$;


ALTER FUNCTION "public"."verify_system_code"("code_input" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_password_reset_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reset_at" timestamp with time zone DEFAULT "now"(),
    "ip_address" "inet",
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_password_reset_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_reset_code_store" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_reset_code_store" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."city_style_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "asset_type" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    CONSTRAINT "city_style_assets_asset_type_check" CHECK (("asset_type" = ANY (ARRAY['building'::"text", 'decoration'::"text", 'map_element'::"text", 'facility_visual'::"text", 'building_visual'::"text", 'ground'::"text"])))
);


ALTER TABLE "public"."city_style_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "coins" integer NOT NULL,
    "type" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "class_rewards_type_check" CHECK (("type" = ANY (ARRAY['reward'::"text", 'consequence'::"text"])))
);


ALTER TABLE "public"."class_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coin_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "reason" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."coin_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_error_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" NOT NULL,
    "error_code" "text",
    "error_message" "text" NOT NULL,
    "file_path" "text",
    "line_number" integer,
    "trigger_action" "text",
    "environment" "text" DEFAULT 'development'::"text",
    "solution" "text" NOT NULL,
    "prevention" "text",
    "occurrence_count" integer DEFAULT 1,
    "last_occurred_at" timestamp with time zone DEFAULT "now"(),
    "resolved" boolean DEFAULT true,
    "tags" "text"[],
    CONSTRAINT "dev_error_log_category_check" CHECK (("category" = ANY (ARRAY['file_edit'::"text", 'import_missing'::"text", 'type_mismatch'::"text", 'lint_error'::"text", 'build_failure'::"text", 'runtime_error'::"text", 'database'::"text", 'git'::"text", 'deployment'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."dev_error_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."dev_error_log" IS 'Knowledge base of development errors and solutions for reference';



CREATE OR REPLACE VIEW "public"."common_errors" AS
 SELECT "category",
    "error_message",
    "solution",
    "prevention",
    "occurrence_count",
    "tags"
   FROM "public"."dev_error_log"
  ORDER BY "occurrence_count" DESC, "last_occurred_at" DESC;


ALTER VIEW "public"."common_errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_reference" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "grade_level" "text" NOT NULL,
    "category_tags" "text"[] DEFAULT '{}'::"text"[],
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "usage_count" integer DEFAULT 0,
    CONSTRAINT "content_reference_grade_level_check" CHECK (("grade_level" = ANY (ARRAY['P.1'::"text", 'P.2'::"text", 'P.3'::"text", 'P.4'::"text", 'P.5'::"text", 'P.6'::"text"])))
);


ALTER TABLE "public"."content_reference" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "sprite_key" "text",
    "default_properties" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."items_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memorization_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_by" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "due_date" timestamp with time zone,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."memorization_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memorization_practice_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content_id" "uuid",
    "title" "text" NOT NULL,
    "original_text" "text" NOT NULL,
    "total_words" integer DEFAULT 0 NOT NULL,
    "hidden_words_count" integer DEFAULT 0 NOT NULL,
    "session_duration_seconds" integer DEFAULT 0 NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "assignment_id" "uuid"
);


ALTER TABLE "public"."memorization_practice_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "category" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "icon" "text" DEFAULT 'MessageSquare'::"text",
    "color" "text" DEFAULT 'text-blue-500 bg-blue-100'::"text",
    CONSTRAINT "notification_templates_type_check" CHECK (("type" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text"])))
);


ALTER TABLE "public"."notification_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "reason" "text",
    "submitted_by_token" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "processed_by" "uuid",
    CONSTRAINT "pending_rewards_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."pending_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."practice_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "practice_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "due_date" timestamp with time zone,
    "assigned_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."practice_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proofreading_practice_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "practice_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_by" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "due_date" timestamp with time zone,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proofreading_practice_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proofreading_practice_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sentences" "text"[] NOT NULL,
    "correct_answers" "jsonb" NOT NULL,
    "user_answers" "jsonb" NOT NULL,
    "correct_count" integer DEFAULT 0 NOT NULL,
    "total_count" integer DEFAULT 0 NOT NULL,
    "accuracy_percentage" integer DEFAULT 0 NOT NULL,
    "time_spent_seconds" integer DEFAULT 0 NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "practice_id" "uuid",
    "assignment_id" "uuid"
);


ALTER TABLE "public"."proofreading_practice_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proofreading_practices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "sentences" "jsonb" NOT NULL,
    "answers" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."proofreading_practices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_facilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "region_id" "uuid" NOT NULL,
    "plot_id" "uuid",
    "facility_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "position_x" integer NOT NULL,
    "position_y" integer NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."public_facilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommended_voices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "accent_code" "text" NOT NULL,
    "voice_name" "text" NOT NULL,
    "voice_uri" "text",
    "priority" integer DEFAULT 0,
    "is_ios_native" boolean DEFAULT false,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recommended_voices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."region_map_elements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "region_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "x" integer NOT NULL,
    "y" integer NOT NULL,
    "z_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."region_map_elements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."region_plots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "region_id" "uuid" NOT NULL,
    "owner_id" "uuid",
    "position_x" integer NOT NULL,
    "position_y" integer NOT NULL,
    "size_width" integer DEFAULT 1 NOT NULL,
    "size_depth" integer DEFAULT 1 NOT NULL,
    "plot_type" "text" DEFAULT 'empty'::"text" NOT NULL,
    "city_level" integer,
    "city_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."region_plots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "grid_size" integer DEFAULT 10 NOT NULL,
    "theme" "text" DEFAULT 'countryside'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."regions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "layout" "jsonb" DEFAULT '[]'::"jsonb",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_contents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "original_text" "text" NOT NULL,
    "selected_word_indices" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_published" boolean DEFAULT false,
    "public_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_contents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    "last_validated" timestamp with time zone DEFAULT "now"(),
    "created_at_idx" timestamp with time zone GENERATED ALWAYS AS ("created_at") STORED
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."set_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "set_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_by" "uuid" NOT NULL,
    "due_date" timestamp with time zone,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."set_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shared_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(16), 'hex'::"text") NOT NULL,
    "type" "text" DEFAULT 'class_dashboard'::"text" NOT NULL,
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."shared_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spaced_repetition_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "selected_answer_index" integer NOT NULL,
    "is_correct" boolean NOT NULL,
    "response_time_ms" integer,
    "quality_rating" integer,
    "attempt_date" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "spaced_repetition_attempts_quality_rating_check" CHECK ((("quality_rating" >= 0) AND ("quality_rating" <= 5)))
);


ALTER TABLE "public"."spaced_repetition_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spaced_repetition_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "set_id" "uuid" NOT NULL,
    "question_text" "text" NOT NULL,
    "choices" "jsonb" NOT NULL,
    "correct_answer_index" integer NOT NULL,
    "explanation" "text",
    "difficulty" "text" DEFAULT 'medium'::"text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "spaced_repetition_questions_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"])))
);


ALTER TABLE "public"."spaced_repetition_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spaced_repetition_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "ease_factor" numeric DEFAULT 2.5,
    "interval_days" integer DEFAULT 1,
    "repetitions" integer DEFAULT 0,
    "next_review_date" timestamp with time zone DEFAULT "now"(),
    "last_reviewed_at" timestamp with time zone,
    "last_quality_rating" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."spaced_repetition_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spaced_repetition_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "difficulty" "text" DEFAULT 'medium'::"text",
    "total_questions" integer DEFAULT 0,
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "spaced_repetition_sets_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"])))
);


ALTER TABLE "public"."spaced_repetition_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spelling_practice_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "words" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."spelling_practice_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spelling_practice_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "practice_id" "uuid",
    "title" "text" NOT NULL,
    "words" "text"[] NOT NULL,
    "user_answers" "jsonb" NOT NULL,
    "correct_count" integer DEFAULT 0 NOT NULL,
    "total_count" integer DEFAULT 0 NOT NULL,
    "accuracy_percentage" integer DEFAULT 0 NOT NULL,
    "practice_level" integer DEFAULT 1 NOT NULL,
    "time_spent_seconds" integer DEFAULT 0 NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "assignment_id" "uuid"
);


ALTER TABLE "public"."spelling_practice_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spelling_practices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "words" "text"[] NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."spelling_practices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_read" boolean DEFAULT false,
    "is_internal" boolean DEFAULT false,
    "coin_amount" integer DEFAULT 0,
    CONSTRAINT "student_records_type_check" CHECK (("type" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text"])))
);


ALTER TABLE "public"."student_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."target_behaviors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "icon" "text",
    "coin_value" integer DEFAULT 1 NOT NULL,
    "category" "text" DEFAULT 'general'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."target_behaviors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ui_builder_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "category" "text",
    "context" "text",
    CONSTRAINT "ui_builder_assets_type_check" CHECK (("type" = ANY (ARRAY['image'::"text", 'document'::"text", 'data'::"text"])))
);


ALTER TABLE "public"."ui_builder_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_type" "text" NOT NULL,
    "achievement_name" "text" NOT NULL,
    "description" "text",
    "icon_name" "text",
    "earned_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_achievements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_room_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "room_id" "uuid",
    "coins" integer DEFAULT 0,
    "virtual_coins" integer DEFAULT 0,
    "daily_counts" "jsonb" DEFAULT '{}'::"jsonb",
    "house_level" integer DEFAULT 1,
    "inventory" "text"[] DEFAULT '{}'::"text"[],
    "placements" "jsonb" DEFAULT '[]'::"jsonb",
    "wall_placements" "jsonb" DEFAULT '[]'::"jsonb",
    "custom_catalog" "jsonb" DEFAULT '{}'::"jsonb",
    "custom_floors" "jsonb" DEFAULT '{}'::"jsonb",
    "custom_walls" "jsonb" DEFAULT '{}'::"jsonb",
    "custom_models" "jsonb" DEFAULT '{}'::"jsonb",
    "active_floor_id" "text",
    "active_wall_id" "text",
    "morning_status" "text" DEFAULT 'todo'::"text",
    "last_morning_update" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_room_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_streaks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "current_streak_days" integer DEFAULT 0,
    "longest_streak_days" integer DEFAULT 0,
    "last_practice_date" "date",
    "total_cards_learned" integer DEFAULT 0,
    "total_cards_mastered" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_streaks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "role" "text" NOT NULL,
    "force_password_change" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "accent_preference" "text" DEFAULT 'en-US'::"text",
    "can_access_proofreading" boolean DEFAULT false,
    "can_access_spelling" boolean DEFAULT false,
    "display_name" "text",
    "voice_name" "text",
    "voice_lang" "text",
    "voice_uri" "text",
    "can_access_learning_hub" boolean DEFAULT false,
    "class" "text",
    "can_access_spaced_repetition" boolean DEFAULT false,
    "coins" integer DEFAULT 0,
    "seat_number" integer,
    "qr_token" "uuid" DEFAULT "gen_random_uuid"(),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_password_reset_log"
    ADD CONSTRAINT "admin_password_reset_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_reset_code_store"
    ADD CONSTRAINT "admin_reset_code_store_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."city_style_assets"
    ADD CONSTRAINT "city_style_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_rewards"
    ADD CONSTRAINT "class_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coin_transactions"
    ADD CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_reference"
    ADD CONSTRAINT "content_reference_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dev_error_log"
    ADD CONSTRAINT "dev_error_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items_catalog"
    ADD CONSTRAINT "items_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memorization_assignments"
    ADD CONSTRAINT "memorization_assignments_content_id_user_id_key" UNIQUE ("content_id", "user_id");



ALTER TABLE ONLY "public"."memorization_assignments"
    ADD CONSTRAINT "memorization_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memorization_practice_sessions"
    ADD CONSTRAINT "memorization_practice_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_rewards"
    ADD CONSTRAINT "pending_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_assignments"
    ADD CONSTRAINT "practice_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_assignments"
    ADD CONSTRAINT "practice_assignments_practice_id_user_id_key" UNIQUE ("practice_id", "user_id");



ALTER TABLE ONLY "public"."proofreading_practice_assignments"
    ADD CONSTRAINT "proofreading_practice_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proofreading_practice_assignments"
    ADD CONSTRAINT "proofreading_practice_assignments_practice_id_user_id_key" UNIQUE ("practice_id", "user_id");



ALTER TABLE ONLY "public"."proofreading_practice_results"
    ADD CONSTRAINT "proofreading_practice_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proofreading_practices"
    ADD CONSTRAINT "proofreading_practices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_facilities"
    ADD CONSTRAINT "public_facilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommended_voices"
    ADD CONSTRAINT "recommended_voices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."region_map_elements"
    ADD CONSTRAINT "region_map_elements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."region_plots"
    ADD CONSTRAINT "region_plots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regions"
    ADD CONSTRAINT "regions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_contents"
    ADD CONSTRAINT "saved_contents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_contents"
    ADD CONSTRAINT "saved_contents_public_id_key" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."set_assignments"
    ADD CONSTRAINT "set_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."set_assignments"
    ADD CONSTRAINT "set_assignments_set_id_user_id_key" UNIQUE ("set_id", "user_id");



ALTER TABLE ONLY "public"."shared_links"
    ADD CONSTRAINT "shared_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_links"
    ADD CONSTRAINT "shared_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."spaced_repetition_attempts"
    ADD CONSTRAINT "spaced_repetition_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spaced_repetition_questions"
    ADD CONSTRAINT "spaced_repetition_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spaced_repetition_schedules"
    ADD CONSTRAINT "spaced_repetition_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spaced_repetition_schedules"
    ADD CONSTRAINT "spaced_repetition_schedules_user_id_question_id_key" UNIQUE ("user_id", "question_id");



ALTER TABLE ONLY "public"."spaced_repetition_sets"
    ADD CONSTRAINT "spaced_repetition_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spelling_practice_lists"
    ADD CONSTRAINT "spelling_practice_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spelling_practice_results"
    ADD CONSTRAINT "spelling_practice_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spelling_practices"
    ADD CONSTRAINT "spelling_practices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_records"
    ADD CONSTRAINT "student_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."target_behaviors"
    ADD CONSTRAINT "target_behaviors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ui_builder_assets"
    ADD CONSTRAINT "ui_builder_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_achievement_type_key" UNIQUE ("user_id", "achievement_type");



ALTER TABLE ONLY "public"."user_room_data"
    ADD CONSTRAINT "user_room_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_room_data"
    ADD CONSTRAINT "user_room_data_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_streaks"
    ADD CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_streaks"
    ADD CONSTRAINT "user_streaks_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_qr_token_key" UNIQUE ("qr_token");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE INDEX "idx_content_reference_created_at" ON "public"."content_reference" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_content_reference_created_by" ON "public"."content_reference" USING "btree" ("created_by");



CREATE INDEX "idx_content_reference_grade_level" ON "public"."content_reference" USING "btree" ("grade_level");



CREATE INDEX "idx_dev_error_log_category" ON "public"."dev_error_log" USING "btree" ("category");



CREATE INDEX "idx_dev_error_log_file" ON "public"."dev_error_log" USING "btree" ("file_path");



CREATE INDEX "idx_dev_error_log_tags" ON "public"."dev_error_log" USING "gin" ("tags");



CREATE INDEX "idx_mem_asgn_content_repair" ON "public"."memorization_assignments" USING "btree" ("content_id");



CREATE INDEX "idx_mem_asgn_user_repair" ON "public"."memorization_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_mem_sess_user_repair" ON "public"."memorization_practice_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_memorization_assignments_assigned_by" ON "public"."memorization_assignments" USING "btree" ("assigned_by");



CREATE INDEX "idx_memorization_assignments_content_id" ON "public"."memorization_assignments" USING "btree" ("content_id");



CREATE INDEX "idx_memorization_assignments_due_date" ON "public"."memorization_assignments" USING "btree" ("due_date");



CREATE INDEX "idx_memorization_assignments_user_completed" ON "public"."memorization_assignments" USING "btree" ("user_id", "completed");



CREATE INDEX "idx_memorization_assignments_user_id" ON "public"."memorization_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_memorization_practice_sessions_assignment_id" ON "public"."memorization_practice_sessions" USING "btree" ("assignment_id");



CREATE INDEX "idx_memorization_sessions_completed_at" ON "public"."memorization_practice_sessions" USING "btree" ("completed_at");



CREATE INDEX "idx_memorization_sessions_content_id" ON "public"."memorization_practice_sessions" USING "btree" ("content_id");



CREATE INDEX "idx_memorization_sessions_user_completed" ON "public"."memorization_practice_sessions" USING "btree" ("user_id", "completed_at" DESC);



CREATE INDEX "idx_memorization_sessions_user_id" ON "public"."memorization_practice_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_notification_templates_type" ON "public"."notification_templates" USING "btree" ("type");



CREATE INDEX "idx_pending_rewards_status" ON "public"."pending_rewards" USING "btree" ("status");



CREATE INDEX "idx_practice_assignments_assigned_by" ON "public"."practice_assignments" USING "btree" ("assigned_by");



CREATE INDEX "idx_practice_assignments_due_date" ON "public"."practice_assignments" USING "btree" ("due_date");



CREATE INDEX "idx_practice_assignments_practice_id" ON "public"."practice_assignments" USING "btree" ("practice_id");



CREATE INDEX "idx_practice_assignments_user_completed" ON "public"."practice_assignments" USING "btree" ("user_id", "completed");



CREATE INDEX "idx_practice_assignments_user_id" ON "public"."practice_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_proofreading_practice_assignments_assigned_by" ON "public"."proofreading_practice_assignments" USING "btree" ("assigned_by");



CREATE INDEX "idx_proofreading_practice_assignments_practice_id" ON "public"."proofreading_practice_assignments" USING "btree" ("practice_id");



CREATE INDEX "idx_proofreading_practice_assignments_user_completed" ON "public"."proofreading_practice_assignments" USING "btree" ("user_id", "completed");



CREATE INDEX "idx_proofreading_practice_assignments_user_id" ON "public"."proofreading_practice_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_proofreading_practice_results_assignment_id" ON "public"."proofreading_practice_results" USING "btree" ("assignment_id");



CREATE INDEX "idx_proofreading_practice_results_practice_id" ON "public"."proofreading_practice_results" USING "btree" ("practice_id");



CREATE INDEX "idx_proofreading_practices_user_id" ON "public"."proofreading_practices" USING "btree" ("user_id");



CREATE INDEX "idx_proofreading_results_completed_at" ON "public"."proofreading_practice_results" USING "btree" ("completed_at");



CREATE INDEX "idx_proofreading_results_user_completed" ON "public"."proofreading_practice_results" USING "btree" ("user_id", "completed_at" DESC);



CREATE INDEX "idx_proofreading_results_user_id" ON "public"."proofreading_practice_results" USING "btree" ("user_id");



CREATE INDEX "idx_recommended_voices_accent_code" ON "public"."recommended_voices" USING "btree" ("accent_code");



CREATE INDEX "idx_recommended_voices_created_by" ON "public"."recommended_voices" USING "btree" ("created_by");



CREATE INDEX "idx_recommended_voices_priority" ON "public"."recommended_voices" USING "btree" ("priority" DESC);



CREATE INDEX "idx_region_map_elements_region_id" ON "public"."region_map_elements" USING "btree" ("region_id");



CREATE INDEX "idx_saved_contents_created_at" ON "public"."saved_contents" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_saved_contents_public_id" ON "public"."saved_contents" USING "btree" ("public_id");



CREATE INDEX "idx_saved_contents_user_id" ON "public"."saved_contents" USING "btree" ("user_id");



CREATE INDEX "idx_sessions_expires_at" ON "public"."sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_sessions_user_id" ON "public"."sessions" USING "btree" ("user_id");



CREATE INDEX "idx_set_assignments_user_id" ON "public"."set_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_shared_links_token" ON "public"."shared_links" USING "btree" ("token");



CREATE INDEX "idx_spaced_repetition_attempts_user_id" ON "public"."spaced_repetition_attempts" USING "btree" ("user_id");



CREATE INDEX "idx_spaced_repetition_questions_set_id" ON "public"."spaced_repetition_questions" USING "btree" ("set_id");



CREATE INDEX "idx_spaced_repetition_schedules_next_review" ON "public"."spaced_repetition_schedules" USING "btree" ("next_review_date");



CREATE INDEX "idx_spaced_repetition_schedules_user_id" ON "public"."spaced_repetition_schedules" USING "btree" ("user_id");



CREATE INDEX "idx_spaced_repetition_sets_user_id" ON "public"."spaced_repetition_sets" USING "btree" ("user_id");



CREATE INDEX "idx_spelling_practice_lists_created_at" ON "public"."spelling_practice_lists" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_spelling_practice_lists_user_id" ON "public"."spelling_practice_lists" USING "btree" ("user_id");



CREATE INDEX "idx_spelling_practice_results_assignment_id" ON "public"."spelling_practice_results" USING "btree" ("assignment_id");



CREATE INDEX "idx_spelling_practices_created_by" ON "public"."spelling_practices" USING "btree" ("created_by");



CREATE INDEX "idx_spelling_results_completed_at" ON "public"."spelling_practice_results" USING "btree" ("completed_at");



CREATE INDEX "idx_spelling_results_practice_id" ON "public"."spelling_practice_results" USING "btree" ("practice_id");



CREATE INDEX "idx_spelling_results_user_completed" ON "public"."spelling_practice_results" USING "btree" ("user_id", "completed_at" DESC);



CREATE INDEX "idx_spelling_results_user_id" ON "public"."spelling_practice_results" USING "btree" ("user_id");



CREATE INDEX "idx_student_records_is_internal" ON "public"."student_records" USING "btree" ("is_internal");



CREATE INDEX "idx_student_records_student_id" ON "public"."student_records" USING "btree" ("student_id");



CREATE INDEX "idx_user_achievements_user_id" ON "public"."user_achievements" USING "btree" ("user_id");



CREATE INDEX "idx_user_streaks_user_id" ON "public"."user_streaks" USING "btree" ("user_id");



CREATE INDEX "idx_users_class" ON "public"."users" USING "btree" ("class") WHERE ("class" IS NOT NULL);



CREATE INDEX "idx_users_qr_token" ON "public"."users" USING "btree" ("qr_token");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE INDEX "idx_users_username" ON "public"."users" USING "btree" ("username");



CREATE INDEX "idx_users_voice_name" ON "public"."users" USING "btree" ("voice_name");



CREATE OR REPLACE TRIGGER "dev_error_log_updated" BEFORE UPDATE ON "public"."dev_error_log" FOR EACH ROW EXECUTE FUNCTION "public"."update_dev_error_log_timestamp"();



CREATE OR REPLACE TRIGGER "on_student_record_deleted" BEFORE DELETE ON "public"."student_records" FOR EACH ROW EXECUTE FUNCTION "public"."handle_student_record_deletion"();



CREATE OR REPLACE TRIGGER "update_content_reference_updated_at" BEFORE UPDATE ON "public"."content_reference" FOR EACH ROW EXECUTE FUNCTION "public"."update_content_reference_updated_at"();



CREATE OR REPLACE TRIGGER "update_memorization_assignments_updated_at" BEFORE UPDATE ON "public"."memorization_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_practice_assignments_updated_at" BEFORE UPDATE ON "public"."practice_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_proofreading_practice_assignments_updated_at" BEFORE UPDATE ON "public"."proofreading_practice_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_proofreading_practices_updated_at" BEFORE UPDATE ON "public"."proofreading_practices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_recommended_voices_updated_at" BEFORE UPDATE ON "public"."recommended_voices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_saved_contents_updated_at" BEFORE UPDATE ON "public"."saved_contents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_spelling_practice_lists_updated_at" BEFORE UPDATE ON "public"."spelling_practice_lists" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_spelling_practices_updated_at" BEFORE UPDATE ON "public"."spelling_practices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."city_style_assets"
    ADD CONSTRAINT "city_style_assets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coin_transactions"
    ADD CONSTRAINT "coin_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."coin_transactions"
    ADD CONSTRAINT "coin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reference"
    ADD CONSTRAINT "content_reference_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memorization_assignments"
    ADD CONSTRAINT "memorization_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memorization_assignments"
    ADD CONSTRAINT "memorization_assignments_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."saved_contents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memorization_assignments"
    ADD CONSTRAINT "memorization_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memorization_practice_sessions"
    ADD CONSTRAINT "memorization_practice_sessions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."memorization_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memorization_practice_sessions"
    ADD CONSTRAINT "memorization_practice_sessions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."saved_contents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."memorization_practice_sessions"
    ADD CONSTRAINT "memorization_practice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pending_rewards"
    ADD CONSTRAINT "pending_rewards_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pending_rewards"
    ADD CONSTRAINT "pending_rewards_submitted_by_token_fkey" FOREIGN KEY ("submitted_by_token") REFERENCES "public"."shared_links"("token");



ALTER TABLE ONLY "public"."pending_rewards"
    ADD CONSTRAINT "pending_rewards_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."practice_assignments"
    ADD CONSTRAINT "practice_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practice_assignments"
    ADD CONSTRAINT "practice_assignments_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "public"."spelling_practices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practice_assignments"
    ADD CONSTRAINT "practice_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proofreading_practice_assignments"
    ADD CONSTRAINT "proofreading_practice_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proofreading_practice_assignments"
    ADD CONSTRAINT "proofreading_practice_assignments_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "public"."proofreading_practices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proofreading_practice_assignments"
    ADD CONSTRAINT "proofreading_practice_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proofreading_practice_results"
    ADD CONSTRAINT "proofreading_practice_results_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."proofreading_practice_assignments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proofreading_practice_results"
    ADD CONSTRAINT "proofreading_practice_results_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "public"."proofreading_practices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proofreading_practice_results"
    ADD CONSTRAINT "proofreading_practice_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proofreading_practices"
    ADD CONSTRAINT "proofreading_practices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."public_facilities"
    ADD CONSTRAINT "public_facilities_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "public"."region_plots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."public_facilities"
    ADD CONSTRAINT "public_facilities_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recommended_voices"
    ADD CONSTRAINT "recommended_voices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."region_map_elements"
    ADD CONSTRAINT "region_map_elements_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."city_style_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."region_map_elements"
    ADD CONSTRAINT "region_map_elements_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."region_plots"
    ADD CONSTRAINT "region_plots_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."region_plots"
    ADD CONSTRAINT "region_plots_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_contents"
    ADD CONSTRAINT "saved_contents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."set_assignments"
    ADD CONSTRAINT "set_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."set_assignments"
    ADD CONSTRAINT "set_assignments_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "public"."spaced_repetition_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."set_assignments"
    ADD CONSTRAINT "set_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_links"
    ADD CONSTRAINT "shared_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."spaced_repetition_attempts"
    ADD CONSTRAINT "spaced_repetition_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."spaced_repetition_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spaced_repetition_attempts"
    ADD CONSTRAINT "spaced_repetition_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spaced_repetition_questions"
    ADD CONSTRAINT "spaced_repetition_questions_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "public"."spaced_repetition_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spaced_repetition_schedules"
    ADD CONSTRAINT "spaced_repetition_schedules_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."spaced_repetition_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spaced_repetition_schedules"
    ADD CONSTRAINT "spaced_repetition_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spaced_repetition_sets"
    ADD CONSTRAINT "spaced_repetition_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spelling_practice_lists"
    ADD CONSTRAINT "spelling_practice_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spelling_practice_results"
    ADD CONSTRAINT "spelling_practice_results_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."practice_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spelling_practice_results"
    ADD CONSTRAINT "spelling_practice_results_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "public"."spelling_practices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."spelling_practice_results"
    ADD CONSTRAINT "spelling_practice_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spelling_practices"
    ADD CONSTRAINT "spelling_practices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_records"
    ADD CONSTRAINT "student_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."student_records"
    ADD CONSTRAINT "student_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ui_builder_assets"
    ADD CONSTRAINT "ui_builder_assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_room_data"
    ADD CONSTRAINT "user_room_data_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_room_data"
    ADD CONSTRAINT "user_room_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_streaks"
    ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin full access" ON "public"."class_rewards" TO "authenticated" USING (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admin write access for map elements" ON "public"."region_map_elements" USING ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can assign sets" ON "public"."set_assignments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "assigned_by"));



CREATE POLICY "Admins can create assignments" ON "public"."memorization_assignments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can create assignments" ON "public"."practice_assignments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can create memorization assignments" ON "public"."memorization_assignments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can create practices" ON "public"."spelling_practices" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can create proofreading assignments" ON "public"."proofreading_practice_assignments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete UI assets" ON "public"."ui_builder_assets" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete any session" ON "public"."sessions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete assignments" ON "public"."memorization_assignments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete assignments" ON "public"."practice_assignments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete content references" ON "public"."content_reference" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete memorization assignments" ON "public"."memorization_assignments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete practices" ON "public"."spelling_practices" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete proofreading assignments" ON "public"."proofreading_practice_assignments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can delete users" ON "public"."users" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can delete voice recommendations" ON "public"."recommended_voices" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert UI assets" ON "public"."ui_builder_assets" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert coin transactions" ON "public"."coin_transactions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert content references" ON "public"."content_reference" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can insert users" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert voice recommendations" ON "public"."recommended_voices" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage error log" ON "public"."dev_error_log" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage notification_templates" ON "public"."notification_templates" TO "authenticated" USING ((((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")));



CREATE POLICY "Admins can manage pending rewards" ON "public"."pending_rewards" TO "authenticated" USING ((((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")));



CREATE POLICY "Admins can manage shared links" ON "public"."shared_links" TO "authenticated" USING ((((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")));



CREATE POLICY "Admins can manage student_records" ON "public"."student_records" TO "authenticated" USING ((((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")));



CREATE POLICY "Admins can manage target behaviors" ON "public"."target_behaviors" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage users" ON "public"."users" TO "authenticated" USING ((((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"))) WITH CHECK ((((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")));



CREATE POLICY "Admins can read all users" ON "public"."users" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can read system config" ON "public"."system_config" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update all users" ON "public"."users" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update assignments" ON "public"."memorization_assignments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update content references" ON "public"."content_reference" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update memorization assignments" ON "public"."memorization_assignments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update practices" ON "public"."spelling_practices" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update proofreading assignments" ON "public"."proofreading_practice_assignments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update spelling assignments" ON "public"."practice_assignments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update users" ON "public"."users" FOR UPDATE TO "authenticated" USING ((((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"))) WITH CHECK ((((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")));



CREATE POLICY "Admins can update voice recommendations" ON "public"."recommended_voices" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view UI assets" ON "public"."ui_builder_assets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all assignments" ON "public"."memorization_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all assignments" ON "public"."practice_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all coin transactions" ON "public"."coin_transactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all content references" ON "public"."content_reference" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all memorization assignments" ON "public"."memorization_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all memorization sessions" ON "public"."memorization_practice_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all practices" ON "public"."spelling_practices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all proofreading assignments" ON "public"."proofreading_practice_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all proofreading results" ON "public"."proofreading_practice_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all spelling results" ON "public"."spelling_practice_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view users" ON "public"."users" FOR SELECT TO "authenticated" USING ((((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text") OR ((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'admin'::"text")));



CREATE POLICY "Admins manage all practices" ON "public"."proofreading_practices" TO "authenticated" USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "All authenticated users can read voice recommendations" ON "public"."recommended_voices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow public read access to city_style_assets" ON "public"."city_style_assets" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to public_facilities" ON "public"."public_facilities" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to region_plots" ON "public"."region_plots" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to regions" ON "public"."regions" FOR SELECT USING (true);



CREATE POLICY "Anyone can read error log" ON "public"."dev_error_log" FOR SELECT USING (true);



CREATE POLICY "Anyone can read published contents" ON "public"."saved_contents" FOR SELECT TO "authenticated", "anon" USING ((("is_published" = true) AND ("public_id" IS NOT NULL)));



CREATE POLICY "Anyone can view inventory items" ON "public"."items_catalog" FOR SELECT USING (true);



CREATE POLICY "Enable delete for authenticated users" ON "public"."public_facilities" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Enable insert for anon" ON "public"."public_facilities" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users" ON "public"."public_facilities" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable update for anon" ON "public"."public_facilities" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for anon" ON "public"."region_plots" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users" ON "public"."public_facilities" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for owners and claimers" ON "public"."region_plots" FOR UPDATE TO "authenticated" USING ((("owner_id" IS NULL) OR ("owner_id" = "auth"."uid"()))) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Everyone can view active target behaviors" ON "public"."target_behaviors" FOR SELECT USING (true);



CREATE POLICY "No direct access to reset codes" ON "public"."admin_reset_code_store" FOR SELECT TO "authenticated" USING (false);



CREATE POLICY "No direct inserts to reset codes" ON "public"."admin_reset_code_store" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "Only admins can view reset log" ON "public"."admin_password_reset_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Public can view public rooms" ON "public"."rooms" FOR SELECT USING (("is_public" = true));



CREATE POLICY "Public read access" ON "public"."class_rewards" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public read access for map elements" ON "public"."region_map_elements" FOR SELECT USING (true);



CREATE POLICY "Students can update own completion status" ON "public"."memorization_assignments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("completed" IS NOT NULL)));



CREATE POLICY "Students can update own memorization completion" ON "public"."memorization_assignments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Students can update own proofreading completion" ON "public"."proofreading_practice_assignments" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Students can update own spelling completion" ON "public"."practice_assignments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("completed" IS NOT NULL)));



CREATE POLICY "Students can view own assignments" ON "public"."memorization_assignments" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Students can view own memorization assignments" ON "public"."memorization_assignments" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Students can view own proofreading assignments" ON "public"."proofreading_practice_assignments" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Students can view own records" ON "public"."student_records" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "student_id") AND ("is_internal" = false)));



CREATE POLICY "Users can create own sets" ON "public"."spaced_repetition_sets" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create questions in own sets" ON "public"."spaced_repetition_questions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."spaced_repetition_sets"
  WHERE (("spaced_repetition_sets"."id" = "spaced_repetition_questions"."set_id") AND ("spaced_repetition_sets"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own saved contents" ON "public"."saved_contents" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "Users can delete own sets" ON "public"."spaced_repetition_sets" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own spelling practice lists" ON "public"."spelling_practice_lists" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "Users can delete questions in own sets" ON "public"."spaced_repetition_questions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."spaced_repetition_sets"
  WHERE (("spaced_repetition_sets"."id" = "spaced_repetition_questions"."set_id") AND ("spaced_repetition_sets"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own attempts" ON "public"."spaced_repetition_attempts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own memorization sessions" ON "public"."memorization_practice_sessions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own proofreading results" ON "public"."proofreading_practice_results" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own saved contents" ON "public"."saved_contents" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "Users can insert own schedules" ON "public"."spaced_repetition_schedules" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own spelling practice lists" ON "public"."spelling_practice_lists" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "Users can insert own spelling results" ON "public"."spelling_practice_results" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage their own room data" ON "public"."user_room_data" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own rooms" ON "public"."rooms" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage their own sessions" ON "public"."memorization_practice_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own data" ON "public"."users" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can read own record" ON "public"."users" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can read own saved contents" ON "public"."saved_contents" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "Users can read own sessions" ON "public"."sessions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own spelling practice lists" ON "public"."spelling_practice_lists" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "Users can update own password" ON "public"."users" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update own saved contents" ON "public"."saved_contents" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "Users can update own schedules" ON "public"."spaced_repetition_schedules" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own sets" ON "public"."spaced_repetition_sets" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own spelling practice lists" ON "public"."spelling_practice_lists" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"()))) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "Users can update own streaks" ON "public"."user_streaks" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update questions in own sets" ON "public"."spaced_repetition_questions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."spaced_repetition_sets"
  WHERE (("spaced_repetition_sets"."id" = "spaced_repetition_questions"."set_id") AND ("spaced_repetition_sets"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view assigned practices" ON "public"."spelling_practices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."practice_assignments"
  WHERE (("practice_assignments"."practice_id" = "spelling_practices"."id") AND ("practice_assignments"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view assigned sets" ON "public"."set_assignments" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "assigned_by")));



CREATE POLICY "Users can view own achievements" ON "public"."user_achievements" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own assignments" ON "public"."practice_assignments" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own attempts" ON "public"."spaced_repetition_attempts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own memorization sessions" ON "public"."memorization_practice_sessions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own proofreading results" ON "public"."proofreading_practice_results" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own schedules" ON "public"."spaced_repetition_schedules" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own sets" ON "public"."spaced_repetition_sets" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR ("is_published" = true)));



CREATE POLICY "Users can view own spelling results" ON "public"."spelling_practice_results" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own streaks" ON "public"."user_streaks" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view questions in accessible sets" ON "public"."spaced_repetition_questions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."spaced_repetition_sets"
  WHERE (("spaced_repetition_sets"."id" = "spaced_repetition_questions"."set_id") AND (("spaced_repetition_sets"."user_id" = "auth"."uid"()) OR ("spaced_repetition_sets"."is_published" = true))))));



CREATE POLICY "Users can view their own coin transactions" ON "public"."coin_transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view assigned practices" ON "public"."proofreading_practices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."proofreading_practice_assignments"
  WHERE (("proofreading_practice_assignments"."practice_id" = "proofreading_practices"."id") AND ("proofreading_practice_assignments"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."admin_password_reset_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_reset_code_store" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."city_style_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coin_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_reference" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dev_error_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."items_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memorization_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memorization_practice_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."practice_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proofreading_practice_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proofreading_practice_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proofreading_practices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_facilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommended_voices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."region_map_elements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."region_plots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_contents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."set_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shared_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spaced_repetition_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spaced_repetition_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spaced_repetition_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spaced_repetition_sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spelling_practice_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spelling_practice_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spelling_practices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."target_behaviors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ui_builder_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_achievements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_room_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_streaks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_change_user_password"("caller_user_id" "uuid", "target_user_id" "uuid", "new_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_change_user_password"("caller_user_id" "uuid", "target_user_id" "uuid", "new_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_change_user_password"("caller_user_id" "uuid", "target_user_id" "uuid", "new_password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_delete_user"("caller_user_id" "uuid", "target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_delete_user"("caller_user_id" "uuid", "target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_delete_user"("caller_user_id" "uuid", "target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."change_user_password"("user_id" "uuid", "new_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."change_user_password"("user_id" "uuid", "new_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_user_password"("user_id" "uuid", "new_password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_sessions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_session"("user_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_session"("user_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_session"("user_id_input" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text", "display_name_input" "text", "can_access_proofreading_input" boolean, "can_access_spelling_input" boolean, "can_access_learning_hub_input" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text", "display_name_input" "text", "can_access_proofreading_input" boolean, "can_access_spelling_input" boolean, "can_access_learning_hub_input" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text", "display_name_input" "text", "can_access_proofreading_input" boolean, "can_access_spelling_input" boolean, "can_access_learning_hub_input" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text", "display_name_input" "text", "can_access_proofreading_input" boolean, "can_access_spelling_input" boolean, "can_access_learning_hub_input" boolean, "class_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text", "display_name_input" "text", "can_access_proofreading_input" boolean, "can_access_spelling_input" boolean, "can_access_learning_hub_input" boolean, "class_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_with_password"("username_input" "text", "password_input" "text", "role_input" "text", "display_name_input" "text", "can_access_proofreading_input" boolean, "can_access_spelling_input" boolean, "can_access_learning_hub_input" boolean, "class_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_session"("session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_session"("session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_session"("session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_assignments_admin_view"("filter_type" "text", "filter_status" "text", "filter_student_id" "uuid", "sort_by" "text", "sort_order" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_assignments_admin_view"("filter_type" "text", "filter_status" "text", "filter_student_id" "uuid", "sort_by" "text", "sort_order" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_assignments_admin_view"("filter_type" "text", "filter_status" "text", "filter_student_id" "uuid", "sort_by" "text", "sort_order" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_assignments_overview"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_assignments_overview"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_assignments_overview"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_students_performance"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_students_performance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_students_performance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_class_analytics_summary"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_class_analytics_summary"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_class_analytics_summary"("date_from" timestamp with time zone, "date_to" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_memorization_assignment_stats"("target_content_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_memorization_assignment_stats"("target_content_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_memorization_assignment_stats"("target_content_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_overdue_assignments"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_overdue_assignments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_overdue_assignments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_performance_distribution"("practice_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_performance_distribution"("practice_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_performance_distribution"("practice_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_practice_activity_timeline"("days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_practice_activity_timeline"("days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_practice_activity_timeline"("days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_proofreading_assignment_stats"("target_practice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_proofreading_assignment_stats"("target_practice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_proofreading_assignment_stats"("target_practice_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_proofreading_rankings"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_proofreading_rankings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_proofreading_rankings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recent_activity"("limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_activity"("limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_activity"("limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recommended_voice"("p_accent_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_recommended_voice"("p_accent_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recommended_voice"("p_accent_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_spelling_rankings"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_spelling_rankings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_spelling_rankings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_student_assignments_unified"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_student_assignments_unified"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_student_assignments_unified"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_student_detailed_analytics"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_student_detailed_analytics"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_student_detailed_analytics"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_assigned_memorizations"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_assigned_memorizations"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_assigned_memorizations"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_assigned_proofreading_practices"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_assigned_proofreading_practices"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_assigned_proofreading_practices"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_progress_summary"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_progress_summary"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_progress_summary"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_saved_contents_count"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_saved_contents_count"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_saved_contents_count"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_sessions"("user_id_input" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_sessions"("user_id_input" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_sessions"("user_id_input" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_student_record_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_student_record_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_student_record_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_coins"("user_id" "uuid", "amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_coins"("user_id" "uuid", "amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_coins"("user_id" "uuid", "amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_room_coins"("target_user_id" "uuid", "amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_room_coins"("target_user_id" "uuid", "amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_room_coins"("target_user_id" "uuid", "amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_room_coins"("target_user_id" "uuid", "amount" integer, "log_reason" "text", "log_admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_room_coins"("target_user_id" "uuid", "amount" integer, "log_reason" "text", "log_admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_room_coins"("target_user_id" "uuid", "amount" integer, "log_reason" "text", "log_admin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_first_admin"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_first_admin"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_first_admin"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_admin_password_reset_attempt"("reset_status" "text", "ip_addr" "inet") TO "anon";
GRANT ALL ON FUNCTION "public"."log_admin_password_reset_attempt"("reset_status" "text", "ip_addr" "inet") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_admin_password_reset_attempt"("reset_status" "text", "ip_addr" "inet") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_assignment_complete"("p_assignment_id" "uuid", "p_assignment_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_assignment_complete"("p_assignment_id" "uuid", "p_assignment_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_assignment_complete"("p_assignment_id" "uuid", "p_assignment_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_spelling_assignment_complete"("target_assignment_id" "uuid", "target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_spelling_assignment_complete"("target_assignment_id" "uuid", "target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_spelling_assignment_complete"("target_assignment_id" "uuid", "target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_admin_password"("verification_code" "text", "new_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_admin_password"("verification_code" "text", "new_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_admin_password"("verification_code" "text", "new_password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_admin_password_by_code"("reset_code" "text", "new_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_admin_password_by_code"("reset_code" "text", "new_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_admin_password_by_code"("reset_code" "text", "new_password" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_all_coins"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_all_coins"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_all_coins"() TO "service_role";



GRANT ALL ON FUNCTION "public"."revert_coin_transaction"("transaction_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revert_coin_transaction"("transaction_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revert_coin_transaction"("transaction_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."run_system_health_check"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_system_health_check"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_system_health_check"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_content_reference_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_content_reference_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_content_reference_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_dev_error_log_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_dev_error_log_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_dev_error_log_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text", "new_class" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text", "new_class" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text", "new_class" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text", "new_class" "text", "new_seat_number" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text", "new_class" "text", "new_seat_number" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_info"("caller_user_id" "uuid", "target_user_id" "uuid", "new_username" "text", "new_display_name" "text", "new_role" "text", "new_class" "text", "new_seat_number" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_session"("session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_session"("session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_session"("session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_password"("user_id" "uuid", "password_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_password"("user_id" "uuid", "password_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_password"("user_id" "uuid", "password_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_system_code"("code_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_system_code"("code_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_system_code"("code_input" "text") TO "service_role";



GRANT ALL ON TABLE "public"."admin_password_reset_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_password_reset_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_password_reset_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_reset_code_store" TO "anon";
GRANT ALL ON TABLE "public"."admin_reset_code_store" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_reset_code_store" TO "service_role";



GRANT ALL ON TABLE "public"."city_style_assets" TO "anon";
GRANT ALL ON TABLE "public"."city_style_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."city_style_assets" TO "service_role";



GRANT ALL ON TABLE "public"."class_rewards" TO "anon";
GRANT ALL ON TABLE "public"."class_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."class_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."coin_transactions" TO "anon";
GRANT ALL ON TABLE "public"."coin_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."coin_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."dev_error_log" TO "anon";
GRANT ALL ON TABLE "public"."dev_error_log" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_error_log" TO "service_role";



GRANT ALL ON TABLE "public"."common_errors" TO "anon";
GRANT ALL ON TABLE "public"."common_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."common_errors" TO "service_role";



GRANT ALL ON TABLE "public"."content_reference" TO "anon";
GRANT ALL ON TABLE "public"."content_reference" TO "authenticated";
GRANT ALL ON TABLE "public"."content_reference" TO "service_role";



GRANT ALL ON TABLE "public"."items_catalog" TO "anon";
GRANT ALL ON TABLE "public"."items_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."items_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."memorization_assignments" TO "anon";
GRANT ALL ON TABLE "public"."memorization_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."memorization_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."memorization_practice_sessions" TO "anon";
GRANT ALL ON TABLE "public"."memorization_practice_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."memorization_practice_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."notification_templates" TO "anon";
GRANT ALL ON TABLE "public"."notification_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_templates" TO "service_role";



GRANT ALL ON TABLE "public"."pending_rewards" TO "anon";
GRANT ALL ON TABLE "public"."pending_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."practice_assignments" TO "anon";
GRANT ALL ON TABLE "public"."practice_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."practice_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."proofreading_practice_assignments" TO "anon";
GRANT ALL ON TABLE "public"."proofreading_practice_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."proofreading_practice_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."proofreading_practice_results" TO "anon";
GRANT ALL ON TABLE "public"."proofreading_practice_results" TO "authenticated";
GRANT ALL ON TABLE "public"."proofreading_practice_results" TO "service_role";



GRANT ALL ON TABLE "public"."proofreading_practices" TO "anon";
GRANT ALL ON TABLE "public"."proofreading_practices" TO "authenticated";
GRANT ALL ON TABLE "public"."proofreading_practices" TO "service_role";



GRANT ALL ON TABLE "public"."public_facilities" TO "anon";
GRANT ALL ON TABLE "public"."public_facilities" TO "authenticated";
GRANT ALL ON TABLE "public"."public_facilities" TO "service_role";



GRANT ALL ON TABLE "public"."recommended_voices" TO "anon";
GRANT ALL ON TABLE "public"."recommended_voices" TO "authenticated";
GRANT ALL ON TABLE "public"."recommended_voices" TO "service_role";



GRANT ALL ON TABLE "public"."region_map_elements" TO "anon";
GRANT ALL ON TABLE "public"."region_map_elements" TO "authenticated";
GRANT ALL ON TABLE "public"."region_map_elements" TO "service_role";



GRANT ALL ON TABLE "public"."region_plots" TO "anon";
GRANT ALL ON TABLE "public"."region_plots" TO "authenticated";
GRANT ALL ON TABLE "public"."region_plots" TO "service_role";



GRANT ALL ON TABLE "public"."regions" TO "anon";
GRANT ALL ON TABLE "public"."regions" TO "authenticated";
GRANT ALL ON TABLE "public"."regions" TO "service_role";



GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT ALL ON TABLE "public"."saved_contents" TO "anon";
GRANT ALL ON TABLE "public"."saved_contents" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_contents" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."set_assignments" TO "anon";
GRANT ALL ON TABLE "public"."set_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."set_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."shared_links" TO "anon";
GRANT ALL ON TABLE "public"."shared_links" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_links" TO "service_role";



GRANT ALL ON TABLE "public"."spaced_repetition_attempts" TO "anon";
GRANT ALL ON TABLE "public"."spaced_repetition_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."spaced_repetition_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."spaced_repetition_questions" TO "anon";
GRANT ALL ON TABLE "public"."spaced_repetition_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."spaced_repetition_questions" TO "service_role";



GRANT ALL ON TABLE "public"."spaced_repetition_schedules" TO "anon";
GRANT ALL ON TABLE "public"."spaced_repetition_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."spaced_repetition_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."spaced_repetition_sets" TO "anon";
GRANT ALL ON TABLE "public"."spaced_repetition_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."spaced_repetition_sets" TO "service_role";



GRANT ALL ON TABLE "public"."spelling_practice_lists" TO "anon";
GRANT ALL ON TABLE "public"."spelling_practice_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."spelling_practice_lists" TO "service_role";



GRANT ALL ON TABLE "public"."spelling_practice_results" TO "anon";
GRANT ALL ON TABLE "public"."spelling_practice_results" TO "authenticated";
GRANT ALL ON TABLE "public"."spelling_practice_results" TO "service_role";



GRANT ALL ON TABLE "public"."spelling_practices" TO "anon";
GRANT ALL ON TABLE "public"."spelling_practices" TO "authenticated";
GRANT ALL ON TABLE "public"."spelling_practices" TO "service_role";



GRANT ALL ON TABLE "public"."student_records" TO "anon";
GRANT ALL ON TABLE "public"."student_records" TO "authenticated";
GRANT ALL ON TABLE "public"."student_records" TO "service_role";



GRANT ALL ON TABLE "public"."system_config" TO "anon";
GRANT ALL ON TABLE "public"."system_config" TO "authenticated";
GRANT ALL ON TABLE "public"."system_config" TO "service_role";



GRANT ALL ON TABLE "public"."target_behaviors" TO "anon";
GRANT ALL ON TABLE "public"."target_behaviors" TO "authenticated";
GRANT ALL ON TABLE "public"."target_behaviors" TO "service_role";



GRANT ALL ON TABLE "public"."ui_builder_assets" TO "anon";
GRANT ALL ON TABLE "public"."ui_builder_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."ui_builder_assets" TO "service_role";



GRANT ALL ON TABLE "public"."user_achievements" TO "anon";
GRANT ALL ON TABLE "public"."user_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_achievements" TO "service_role";



GRANT ALL ON TABLE "public"."user_room_data" TO "anon";
GRANT ALL ON TABLE "public"."user_room_data" TO "authenticated";
GRANT ALL ON TABLE "public"."user_room_data" TO "service_role";



GRANT ALL ON TABLE "public"."user_streaks" TO "anon";
GRANT ALL ON TABLE "public"."user_streaks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_streaks" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







