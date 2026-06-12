-- Migration: Add RPC to update student group settings for authorized class staff and admins
-- Date: 2026-06-12 (UTC/HKT)

CREATE OR REPLACE FUNCTION public.update_student_group_settings(
    p_student_id uuid,
    p_group_no integer,
    p_is_group_leader boolean
) RETURNS void AS $$
DECLARE
    v_class text;
    v_actor_id uuid := auth.uid();
BEGIN
    -- Get the student's class
    SELECT class INTO v_class FROM public.users WHERE id = p_student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    -- Check if the actor is authorized to manage settings for that class
    IF NOT public.is_authorized_for_class(v_actor_id, v_class) THEN
        RAISE EXCEPTION 'Not authorized to manage student group settings for class %', v_class;
    END IF;

    -- Update the student record
    UPDATE public.users
    SET group_no = p_group_no,
        is_group_leader = p_is_group_leader,
        updated_at = now()
    WHERE id = p_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.update_student_group_settings(uuid, integer, boolean) TO authenticated;
