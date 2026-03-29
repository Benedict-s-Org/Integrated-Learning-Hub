-- Migration: Backfill Users to public.users
-- Description: Syncs existing auth.users that might have been missed by the trigger into the public.users table.

-- Migration: Backfill Users to public.users
-- Description: Syncs existing auth.users into the public.users table using direct SQL.

-- 1. Sync users
INSERT INTO public.users (
    id, 
    username, 
    password_hash, 
    role, 
    display_name,
    class,
    created_at,
    updated_at
)
SELECT 
    id,
    email,
    'AUTH_MANAGED',
    COALESCE(raw_user_meta_data->>'role', 'user'),
    COALESCE(raw_user_meta_data->>'display_name', email),
    raw_user_meta_data->>'class',
    created_at,
    created_at
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
    class = COALESCE(EXCLUDED.class, public.users.class),
    role = COALESCE(EXCLUDED.role, public.users.role),
    updated_at = now();

-- 2. Initialize room data
INSERT INTO public.user_room_data (user_id, placements, wall_placements, inventory, custom_catalog, custom_models, custom_walls, custom_floors, coins)
SELECT id, '[]'::jsonb, '[]'::jsonb, ARRAY['hk_stool', 'hk_table', 'hk_bed', 'basement_stairs']::text[], '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 0
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 3. Initialize avatar config
INSERT INTO public.user_avatar_config (user_id, equipped_items, custom_offsets)
SELECT id, '{"outfit": "default", "skin": "default"}'::jsonb, '{}'::jsonb
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
