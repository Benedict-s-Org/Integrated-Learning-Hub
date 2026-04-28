-- Migration: Fix broken get_student_assignments_unified RPC
-- Bug: References sc.level (saved_contents.level) which does not exist
-- Fix: Add the missing column to saved_contents

-- 1. Add the missing 'level' column to saved_contents
ALTER TABLE public.saved_contents ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;

-- 2. Also ensure the get_user_assigned_proofreading_practices has proper GRANT
GRANT EXECUTE ON FUNCTION get_user_assigned_proofreading_practices(uuid) TO authenticated, service_role;
