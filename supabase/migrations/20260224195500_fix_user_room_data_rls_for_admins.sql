-- Allow Admins to manage all user_room_data records
-- This enables administrators to use the Map Editor to save layouts for any user.

DO $$ 
BEGIN
    -- Drop existing policy if it exists to replace it with an admin-inclusive one
    -- Note: We are keeping the original policy but adding a new one for admins
    -- or updating the existing one. It's safer to add a specific admin policy.
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_room_data' AND policyname = 'Admins can manage all room data'
    ) THEN
        CREATE POLICY "Admins can manage all room data"
            ON public.user_room_data
            FOR ALL
            TO authenticated
            USING (public.is_admin(auth.uid()))
            WITH CHECK (public.is_admin(auth.uid()));
    END IF;
END $$;
