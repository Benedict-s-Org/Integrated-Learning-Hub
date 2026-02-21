-- Generalize Avatar Asset Management RLS
-- This migration replaces hardcoded admin email checks with the standard is_admin() function

-- 1. Update public.avatar_items policies
DROP POLICY IF EXISTS "Only MVP Admin can modify items MVP MVP" ON public.avatar_items;
DROP POLICY IF EXISTS "Avatar items are viewable by everyone" ON public.avatar_items;

-- SELECT is still open to everyone
CREATE POLICY "Avatar items are viewable by everyone" 
ON public.avatar_items FOR SELECT USING (true);

-- Management is now open to all admins
DROP POLICY IF EXISTS "Admins can manage avatar items" ON public.avatar_items;
CREATE POLICY "Admins can manage avatar items" 
ON public.avatar_items FOR ALL 
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 2. Update storage.objects policies for 'avatar-assets' bucket
DROP POLICY IF EXISTS "Admin can upload avatar assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update avatar assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete avatar assets" ON storage.objects;
DROP POLICY IF EXISTS "Avatar assets are publicly accessible" ON storage.objects;

-- SELECT
DROP POLICY IF EXISTS "Avatar assets are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar assets are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatar-assets');

-- INSERT
DROP POLICY IF EXISTS "Admins can upload avatar assets" ON storage.objects;
CREATE POLICY "Admins can upload avatar assets" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
    bucket_id = 'avatar-assets' AND
    public.is_admin(auth.uid())
);

-- UPDATE
DROP POLICY IF EXISTS "Admins can update avatar assets" ON storage.objects;
CREATE POLICY "Admins can update avatar assets" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (
    bucket_id = 'avatar-assets' AND
    public.is_admin(auth.uid())
);

-- DELETE
DROP POLICY IF EXISTS "Admins can delete avatar assets" ON storage.objects;
CREATE POLICY "Admins can delete avatar assets" 
ON storage.objects FOR DELETE 
TO authenticated
USING (
    bucket_id = 'avatar-assets' AND
    public.is_admin(auth.uid())
);
