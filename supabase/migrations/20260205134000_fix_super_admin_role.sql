-- Fix super admin role for the main account
UPDATE public.users 
SET role = 'admin' 
WHERE username = 'benedictcftsang@outlook.com';

-- Ensure it's also in auth.users metadata just in case
-- This part cannot be done easily via SQL in some setups without extensions, 
-- but we can at least fix the public.users table which the Edge Function checks.

-- If the user doesn't exist in public.users, they might have been deleted.
-- Let's ensure they exist if they are in auth.users.
INSERT INTO public.users (id, username, password_hash, role, display_name)
SELECT id, email, 'AUTH_MANAGED', 'admin', 'Super Admin'
FROM auth.users
WHERE email = 'benedictcftsang@outlook.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
