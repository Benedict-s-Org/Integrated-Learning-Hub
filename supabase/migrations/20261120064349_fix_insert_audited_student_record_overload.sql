-- Fix ambiguous insert_audited_student_record overloads.
--
-- History:
--   20260311060500 created a 5-arg signature (..., p_reason)
--   20260313030000 added an enhanced signature with optional broadcast args
--     BEFORE p_reason. CREATE OR REPLACE cannot replace a different arity, so
--     both overloads coexisted.
--
-- Calls that only pass the shared named params (e.g. Class Dashboard free-time
-- Toilet/Break logging) match both candidates equally and Postgres raises:
--   "Could not choose the best candidate function between..."

DROP FUNCTION IF EXISTS public.insert_audited_student_record(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.insert_audited_student_record(
    p_student_id UUID,
    p_message TEXT,
    p_type TEXT,
    p_class_id TEXT,
    p_record_type TEXT DEFAULT 'log',
    p_source TEXT DEFAULT NULL,
    p_target_classes TEXT[] DEFAULT NULL,
    p_broadcast_group_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_actor_id UUID := auth.uid();
    v_actor_role TEXT;
BEGIN
    IF NOT (public.is_admin(v_actor_id) OR public.is_authorized_for_class(v_actor_id, p_class_id)) THEN
        RAISE EXCEPTION 'Not authorized to insert records for class %', p_class_id;
    END IF;

    v_actor_role := CASE WHEN public.is_admin(v_actor_id) THEN 'admin' ELSE 'class_staff' END;

    INSERT INTO public.student_records (
        student_id,
        message,
        type,
        created_by,
        record_type,
        source,
        target_classes,
        broadcast_group_id
    )
    VALUES (
        p_student_id,
        p_message,
        p_type,
        v_actor_id,
        p_record_type,
        p_source,
        p_target_classes,
        p_broadcast_group_id
    )
    RETURNING id INTO v_new_id;

    INSERT INTO public.audit_logs (
        entity_table, entity_id, action,
        old_data, new_data,
        actor_user_id, actor_role, class_id, reason
    ) VALUES (
        'student_records', v_new_id, 'create',
        NULL, row_to_json((SELECT r FROM public.student_records r WHERE id = v_new_id)),
        v_actor_id, v_actor_role, p_class_id, p_reason
    );

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.insert_audited_student_record(
    uuid, text, text, text, text, text, text[], uuid, text
) TO authenticated;
