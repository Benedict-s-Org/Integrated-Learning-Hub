-- 4. Create the Role Enum/Constraint logic
-- Note: 'class_staff' role is handled by either auth claims or simply treating it as a standard user with assignment restrictions in this system.
-- For clarity, we will trust the `admin` flag for Admins, and if a user has `class_staff_assignments`, they act as `class_staff`.

-- 5. Create RPCs for Audited Interactions

-- Helper to check if a user is authorized for a class
CREATE OR REPLACE FUNCTION public.is_authorized_for_class(input_user_id UUID, input_class_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- If admin, always true
    IF public.is_admin(input_user_id) THEN
        RETURN true;
    END IF;

    -- Otherwise check assignments
    RETURN EXISTS (
        SELECT 1 FROM public.class_staff_assignments
        WHERE staff_user_id = input_user_id
        AND class_id = input_class_id
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to insert a record into student_records with auditing
CREATE OR REPLACE FUNCTION public.insert_audited_student_record(
    p_student_id UUID,
    p_message TEXT,
    p_type TEXT,
    p_class_id TEXT, -- provided by the frontend context
    p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_actor_id UUID := auth.uid();
    v_actor_role TEXT;
BEGIN
    -- 1. Authorization Check
    IF NOT public.is_authorized_for_class(v_actor_id, p_class_id) THEN
        RAISE EXCEPTION 'Not authorized to insert records for class %', p_class_id;
    END IF;

    v_actor_role := CASE WHEN public.is_admin(v_actor_id) THEN 'admin' ELSE 'class_staff' END;
    
    -- 2. Insert the actual row
    INSERT INTO public.student_records (student_id, message, type, created_by)
    VALUES (p_student_id, p_message, p_type, v_actor_id)
    RETURNING id INTO v_new_id;

    -- 3. Write audit log
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


-- RPC to update a record
CREATE OR REPLACE FUNCTION public.update_audited_student_record(
    p_record_id UUID,
    p_message TEXT,
    p_type TEXT,
    p_class_id TEXT,
    p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_role TEXT;
    v_old_data JSONB;
BEGIN
    -- 1. Authorization
    IF NOT public.is_authorized_for_class(v_actor_id, p_class_id) THEN
        RAISE EXCEPTION 'Not authorized to update records for class %', p_class_id;
    END IF;

    -- 2. Fetch old data
    SELECT row_to_json(r)::jsonb INTO v_old_data
    FROM public.student_records r WHERE id = p_record_id;

    IF v_old_data IS NULL THEN
        RAISE EXCEPTION 'Record not found';
    END IF;

    v_actor_role := CASE WHEN public.is_admin(v_actor_id) THEN 'admin' ELSE 'class_staff' END;

    -- 3. Perform update
    UPDATE public.student_records
    SET message = p_message,
        type = p_type,
        updated_by = v_actor_id
    WHERE id = p_record_id;

    -- 4. Audit Update
    INSERT INTO public.audit_logs (
        entity_table, entity_id, action,
        old_data, new_data,
        actor_user_id, actor_role, class_id, reason
    ) VALUES (
        'student_records', p_record_id, 'update',
        v_old_data, row_to_json((SELECT r FROM public.student_records r WHERE id = p_record_id)),
        v_actor_id, v_actor_role, p_class_id, p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to soft delete a record
CREATE OR REPLACE FUNCTION public.soft_delete_audited_student_record(
    p_record_id UUID,
    p_class_id TEXT,
    p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_role TEXT;
    v_old_data JSONB;
BEGIN
    -- 1. Authorization Check
    IF NOT public.is_authorized_for_class(v_actor_id, p_class_id) THEN
        RAISE EXCEPTION 'Not authorized to delete records in class %', p_class_id;
    END IF;

    SELECT row_to_json(r)::jsonb INTO v_old_data
    FROM public.student_records r WHERE id = p_record_id AND is_deleted = false;

    IF v_old_data IS NULL THEN
        RAISE EXCEPTION 'Record not found or already deleted';
    END IF;

    v_actor_role := CASE WHEN public.is_admin(v_actor_id) THEN 'admin' ELSE 'class_staff' END;

    -- 2. Soft Delete
    UPDATE public.student_records
    SET is_deleted = true,
        deleted_at = now(),
        deleted_by = v_actor_id
    WHERE id = p_record_id;

    -- 3. Audit Log
    INSERT INTO public.audit_logs (
        entity_table, entity_id, action,
        old_data, new_data,
        actor_user_id, actor_role, class_id, reason
    ) VALUES (
        'student_records', p_record_id, 'delete',
        v_old_data, row_to_json((SELECT r FROM public.student_records r WHERE id = p_record_id)),
        v_actor_id, v_actor_role, p_class_id, p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC to revert any audited change (Admin Only)
CREATE OR REPLACE FUNCTION public.revert_audited_change(p_audit_id UUID)
RETURNS VOID AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_audit_record RECORD;
    v_old_data JSONB;
BEGIN
    -- Must be admin to revert
    IF NOT public.is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Only admins can revert changes';
    END IF;

    -- Fetch the audit record
    SELECT * INTO v_audit_record FROM public.audit_logs WHERE id = p_audit_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Audit record not found';
    END IF;

    v_old_data := v_audit_record.old_data;

    IF v_audit_record.entity_table = 'student_records' THEN
        IF v_audit_record.action = 'delete' THEN
            -- Reverting a delete means undeleting
            UPDATE public.student_records
            SET is_deleted = false,
                deleted_at = NULL,
                deleted_by = NULL,
                -- Optional: restore message/type exactly via v_old_data->>'message'
                message = v_old_data->>'message',
                type = v_old_data->>'type'
            WHERE id = (v_old_data->>'id')::UUID;
            
        ELSIF v_audit_record.action = 'update' THEN
            -- Restore old fields
            UPDATE public.student_records
            SET message = v_old_data->>'message',
                type = v_old_data->>'type',
                is_deleted = (v_old_data->>'is_deleted')::BOOLEAN
            WHERE id = (v_old_data->>'id')::UUID;
            
        ELSIF v_audit_record.action = 'create' THEN
            -- Reverting a create means deleting it (soft delete preferred to preserve chain)
            UPDATE public.student_records
            SET is_deleted = true,
                deleted_at = now(),
                deleted_by = v_actor_id
            WHERE id = v_audit_record.entity_id;
        END IF;

        -- Write the revert action
        INSERT INTO public.audit_logs (
            entity_table, entity_id, action,
            old_data, new_data,
            actor_user_id, actor_role, class_id, reason
        ) VALUES (
            'student_records', v_audit_record.entity_id, 'revert',
            row_to_json((SELECT r FROM public.student_records r WHERE id = v_audit_record.entity_id)),
            v_old_data,
            v_actor_id, 'admin', v_audit_record.class_id, 'Reverted audit log: ' || p_audit_id
        );
    ELSE
        RAISE EXCEPTION 'Revert not implemented for table %', v_audit_record.entity_table;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
