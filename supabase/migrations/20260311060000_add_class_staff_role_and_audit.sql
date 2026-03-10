-- 1. Create class_staff_assignments mapping table
CREATE TABLE IF NOT EXISTS public.class_staff_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    class_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(staff_user_id, class_id)
);

-- RLS for class_staff_assignments
ALTER TABLE public.class_staff_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage class staff assignments"
    ON public.class_staff_assignments FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Staff can view their own assignments"
    ON public.class_staff_assignments FOR SELECT
    USING (auth.uid() = staff_user_id AND is_active = true);


-- 2. Add Soft Delete & Tracking Fields to Target Tables
-- student_records (Rewards, Consequences, Toilet/Break)
ALTER TABLE public.student_records
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- 3. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_table TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'revert')),
    old_data JSONB,
    new_data JSONB,
    actor_user_id UUID REFERENCES auth.users(id) NOT NULL,
    actor_role TEXT,
    class_id TEXT,
    reason TEXT,
    request_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view and manage audit logs"
    ON public.audit_logs FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "System can insert audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (true); -- Only intended to be written via SECURITY DEFINER RPCs

