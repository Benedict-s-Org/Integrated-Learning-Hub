-- Migration: Emergency Login Fix
-- Description: Makes password_hash nullable to allow Supabase Auth sync triggers to succeed.

-- 1. Make password_hash nullable
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Ensure voice_preference and custom_offsets are handled (Full sync repair)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS voice_preference JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.user_avatar_config ADD COLUMN IF NOT EXISTS custom_offsets JSONB DEFAULT '{}'::jsonb;

-- 3. Redefine handle_new_auth_user with a default password_hash for safety (optional but helpful)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  m_id uuid;
BEGIN
  -- A. Parse managed_by_id safely
  BEGIN
    IF (NEW.raw_user_meta_data->>'managed_by_id') IS NOT NULL AND (NEW.raw_user_meta_data->>'managed_by_id') <> '' THEN
      m_id := (NEW.raw_user_meta_data->>'managed_by_id')::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    m_id := NULL;
  END;

  -- B. Upsert into public.users based on ID
  -- We provide a dummy password_hash if it's missing (though it's now nullable)
  INSERT INTO public.users (
    id, 
    username, 
    role, 
    display_name,
    class,
    managed_by_id,
    voice_preference,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'class',
    m_id,
    COALESCE(NEW.raw_user_meta_data->'voice_preference', '{}'::jsonb),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    role = EXCLUDED.role,
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    class = COALESCE(EXCLUDED.class, users.class),
    managed_by_id = COALESCE(EXCLUDED.managed_by_id, users.managed_by_id),
    voice_preference = COALESCE(EXCLUDED.voice_preference, users.voice_preference),
    updated_at = now();

  -- C. Ensure peripheral tables are initialized
  INSERT INTO public.user_room_data (user_id, placements, wall_placements, inventory, custom_catalog, custom_models, custom_walls, custom_floors, coins)
  VALUES (NEW.id, '[]'::jsonb, '[]'::jsonb, '["hk_stool", "hk_table", "hk_bed", "basement_stairs"]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_avatar_config (user_id, equipped_items, custom_offsets)
  VALUES (NEW.id, '{"outfit": "default", "skin": "default"}'::jsonb, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
