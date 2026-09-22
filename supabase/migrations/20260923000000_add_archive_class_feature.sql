-- Migration: Add Archive Class Feature
-- Purpose: Support class archiving, student academic year records backup, and resetting coins to 0 with balancing audit records
-- Path: supabase/migrations/20260923000000_add_archive_class_feature.sql

-- 1. Alter classes table to add archive columns
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS academic_year TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_classes_is_archived ON public.classes(is_archived);

-- 2. Drop legacy function signatures if any
DROP FUNCTION IF EXISTS public.archive_class(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.archive_class(TEXT, UUID, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.unarchive_class(TEXT);

-- 3. Create archive_class RPC
CREATE OR REPLACE FUNCTION public.archive_class(
    p_class_name TEXT,
    p_archived_by UUID DEFAULT NULL,
    p_academic_year TEXT DEFAULT NULL,
    p_auto_recreate BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
    v_operator_id UUID;
    v_user_count INT := 0;
    v_student RECORD;
    v_archive_time TIMESTAMPTZ := NOW();
    v_year_clean TEXT;
    v_archived_name TEXT;
BEGIN
    v_operator_id := COALESCE(p_archived_by, auth.uid());
    
    -- Clean academic year label (e.g. "2025-2026" or "2526")
    v_year_clean := TRIM(COALESCE(NULLIF(p_academic_year, ''), TO_CHAR(v_archive_time, 'YYYY') || '-' || TO_CHAR(v_archive_time + INTERVAL '1 year', 'YYYY')));
    v_archived_name := TRIM(p_class_name) || ' (' || v_year_clean || ')';

    -- Authorization check: caller must be admin
    IF v_operator_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = v_operator_id 
          AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can archive a class';
    END IF;

    -- 1. Reset coins and insert balancing records for all students currently in this class
    FOR v_student IN (
        SELECT 
            u.id, 
            u.display_name, 
            COALESCE(urd.coins, 0) AS current_coins, 
            COALESCE(urd.virtual_coins, 0) AS current_virtual_coins
        FROM public.users u
        LEFT JOIN public.user_room_data urd ON urd.user_id = u.id
        WHERE u.class = p_class_name
    ) LOOP
        v_user_count := v_user_count + 1;

        -- Balancing record for real coins (if not zero)
        IF v_student.current_coins != 0 THEN
            INSERT INTO public.student_records (
                student_id,
                type,
                message,
                coin_amount,
                created_by,
                is_virtual,
                created_at
            ) VALUES (
                v_student.id,
                'neutral',
                '學年班別封存：金幣重設歸零 (' || v_year_clean || ')',
                -v_student.current_coins,
                v_operator_id,
                FALSE,
                v_archive_time
            );
        END IF;

        -- Balancing record for virtual coins (if not zero)
        IF v_student.current_virtual_coins != 0 THEN
            INSERT INTO public.student_records (
                student_id,
                type,
                message,
                coin_amount,
                created_by,
                is_virtual,
                created_at
            ) VALUES (
                v_student.id,
                'neutral',
                '學年班別封存：虛擬金幣重設歸零 (' || v_year_clean || ')',
                -v_student.current_virtual_coins,
                v_operator_id,
                TRUE,
                v_archive_time
            );
        END IF;

        -- Reset student user_room_data
        UPDATE public.user_room_data
        SET coins = 0,
            virtual_coins = 0,
            daily_counts = '{}'::jsonb,
            morning_status = 'todo',
            updated_at = v_archive_time
        WHERE user_id = v_student.id;
    END LOOP;

    -- 2. Update students' class to the archived year name so they don't collide with the new clean class
    UPDATE public.users
    SET class = v_archived_name
    WHERE class = p_class_name;

    -- 3. Archive the class in public.classes table (rename to archived name to free up clean name)
    -- Remove any pre-existing duplicate with the target archived name
    DELETE FROM public.classes WHERE name = v_archived_name;

    UPDATE public.classes
    SET name = v_archived_name,
        is_archived = TRUE,
        archived_at = v_archive_time,
        academic_year = v_year_clean
    WHERE name = p_class_name;

    IF NOT FOUND THEN
        INSERT INTO public.classes (name, is_archived, archived_at, academic_year)
        VALUES (v_archived_name, TRUE, v_archive_time, v_year_clean);
    END IF;

    -- 4. Recreate the fresh clean class if requested
    IF p_auto_recreate THEN
        INSERT INTO public.classes (name, is_archived, academic_year)
        VALUES (p_class_name, FALSE, NULL)
        ON CONFLICT (name) DO UPDATE 
        SET is_archived = FALSE, archived_at = NULL;
    END IF;

    -- Reload schema cache
    NOTIFY pgrst, 'reload schema';

    RETURN jsonb_build_object(
        'success', TRUE,
        'original_class', p_class_name,
        'archived_class', v_archived_name,
        'academic_year', v_year_clean,
        'archived_students_count', v_user_count,
        'auto_recreated', p_auto_recreate,
        'archived_at', v_archive_time
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create unarchive_class RPC
CREATE OR REPLACE FUNCTION public.unarchive_class(p_class_name TEXT)
RETURNS JSONB AS $$
BEGIN
    -- Unarchive the class
    UPDATE public.classes
    SET is_archived = FALSE,
        archived_at = NULL
    WHERE name = p_class_name;

    NOTIFY pgrst, 'reload schema';

    RETURN jsonb_build_object(
        'success', TRUE,
        'class_name', p_class_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.archive_class(TEXT, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unarchive_class(TEXT) TO authenticated;
