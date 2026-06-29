-- Migration: Add Homework Exemptions
-- Description: Adds homework exemptions feature to morning duties

-- 1. Update the status check constraint to allow 'exempted'
ALTER TABLE public.morning_duty_logs DROP CONSTRAINT IF EXISTS morning_duty_logs_status_check;
ALTER TABLE public.morning_duty_logs ADD CONSTRAINT morning_duty_logs_status_check CHECK (status IN ('todo', 'submitted', 'missing', 'absent', 'late', 'exempted'));

-- 2. Create the homework_exemptions table
CREATE TABLE IF NOT EXISTS public.homework_exemptions (
    log_id uuid PRIMARY KEY REFERENCES public.morning_duty_logs(id) ON DELETE CASCADE,
    previous_lane text NOT NULL,
    previous_missing_homework jsonb,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    set_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.homework_exemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff/Admins can read exemptions" ON public.homework_exemptions
    FOR SELECT TO authenticated
    USING (public.is_authorized_for_class(auth.uid(), (SELECT class FROM public.morning_duty_logs WHERE id = homework_exemptions.log_id)));

-- We don't need INSERT/UPDATE policies because the requirement states:
-- "Direct client insert/update/delete to the exemption table should not be allowed. Writes should go through the RPC only."

-- 3. Create the RPC function
CREATE OR REPLACE FUNCTION public.set_homework_exemption(
    p_log_id uuid,
    p_is_exempted boolean,
    p_reason text DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_class text;
    v_current_status text;
    v_current_missing jsonb;
    v_prev_lane text;
    v_prev_missing jsonb;
BEGIN
    -- Check authorization
    SELECT class, status, missing_items 
    INTO v_class, v_current_status, v_current_missing 
    FROM public.morning_duty_logs 
    WHERE id = p_log_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Log not found';
    END IF;
    
    IF NOT public.is_authorized_for_class(v_actor_id, v_class) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_is_exempted THEN
        -- Only allow exempting if not already exempted
        IF v_current_status != 'exempted' THEN
            -- Insert into exemptions
            INSERT INTO public.homework_exemptions (log_id, previous_lane, previous_missing_homework, reason, set_by, updated_at)
            VALUES (p_log_id, v_current_status, v_current_missing, p_reason, v_actor_id, now())
            ON CONFLICT (log_id) DO UPDATE SET
                previous_lane = EXCLUDED.previous_lane,
                previous_missing_homework = EXCLUDED.previous_missing_homework,
                reason = EXCLUDED.reason,
                set_by = EXCLUDED.set_by,
                updated_at = EXCLUDED.updated_at;
                
            -- Update logs
            UPDATE public.morning_duty_logs 
            SET status = 'exempted', updated_at = now()
            WHERE id = p_log_id;
        END IF;
    ELSE
        -- Removing exemption
        IF v_current_status = 'exempted' THEN
            SELECT previous_lane, previous_missing_homework 
            INTO v_prev_lane, v_prev_missing
            FROM public.homework_exemptions 
            WHERE log_id = p_log_id;
            
            -- If for some reason there's no exemption record, fallback to todo
            IF NOT FOUND THEN
                v_prev_lane := 'todo';
                v_prev_missing := NULL;
            END IF;
            
            -- Restore original state
            UPDATE public.morning_duty_logs 
            SET status = v_prev_lane, missing_items = v_prev_missing, updated_at = now()
            WHERE id = p_log_id;
            
            -- Delete exemption record
            DELETE FROM public.homework_exemptions WHERE log_id = p_log_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.set_homework_exemption(uuid, boolean, text) TO authenticated;

-- 4. Update get_morning_duty_stats to include exempted count
DROP FUNCTION IF EXISTS public.get_morning_duty_stats(text, date, date);
CREATE OR REPLACE FUNCTION public.get_morning_duty_stats(
    p_class text, p_start date, p_end date
) RETURNS TABLE (
    student_id uuid, username text, display_name text,
    total_days bigint, submitted_days bigint, missing_days bigint, absent_days bigint,
    exempted_days bigint,
    needs_reminding_days bigint, ignored_after_reminding_days bigint,
    outstanding_days bigint, submission_rate numeric
) AS $$
DECLARE v_actor_id uuid := auth.uid();
BEGIN
    IF NOT public.is_authorized_for_class(v_actor_id, p_class) THEN
        RAISE EXCEPTION 'Not authorized to view stats for class %', p_class;
    END IF;
    RETURN QUERY
    SELECT
        u.id AS student_id, u.username, u.display_name,
        COALESCE(COUNT(l.id), 0)::bigint AS total_days,
        COALESCE(SUM(CASE WHEN l.status = 'submitted' THEN 1 ELSE 0 END), 0)::bigint AS submitted_days,
        COALESCE(SUM(CASE WHEN l.status = 'missing' THEN 1 ELSE 0 END), 0)::bigint AS missing_days,
        COALESCE(SUM(CASE WHEN l.status = 'absent' THEN 1 ELSE 0 END), 0)::bigint AS absent_days,
        COALESCE(SUM(CASE WHEN l.status = 'exempted' THEN 1 ELSE 0 END), 0)::bigint AS exempted_days,
        COALESCE(SUM(CASE WHEN l.snapshot_0830 = 'todo' AND l.status = 'submitted' THEN 1 ELSE 0 END), 0)::bigint AS needs_reminding_days,
        COALESCE(SUM(CASE WHEN l.snapshot_0835 IN ('todo', 'missing') THEN 1 ELSE 0 END), 0)::bigint AS ignored_after_reminding_days,
        COALESCE(SUM(CASE WHEN l.status = 'missing' AND l.made_up = false THEN 1 ELSE 0 END), 0)::bigint AS outstanding_days,
        CASE WHEN COUNT(l.id) > 0
            THEN ROUND((SUM(CASE WHEN l.status = 'submitted' THEN 1 ELSE 0 END)::numeric / COUNT(l.id)::numeric) * 100, 2)
            ELSE 0.00 END AS submission_rate
    FROM public.users u
    LEFT JOIN public.morning_duty_logs l ON u.id = l.student_id AND l.log_date BETWEEN p_start AND p_end
    WHERE u.class = p_class AND u.role = 'user'
    GROUP BY u.id, u.username, u.display_name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_morning_duty_stats(text, date, date) TO authenticated;

-- 5. Insert initial reasons
INSERT INTO public.app_content (key, content, description)
VALUES ('exemption_reasons', '["做班務", "去洗手間", "見老師", "早退"]'::jsonb, 'Default reasons for morning duty exemption')
ON CONFLICT (key) DO NOTHING;

