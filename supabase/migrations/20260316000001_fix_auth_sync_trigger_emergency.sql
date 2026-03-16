-- Migration: Fix Auth Sync Trigger (Emergency Fix)
-- Description: Safely redefines the handle_new_auth_user function and trigger with defensive casting and logic.
-- This is a new migration to ensure it gets applied via 'supabase db push'.

-- 1. Redefine the function with defensive UUID casting and safe updates
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  m_id uuid;
BEGIN
  -- Parse managed_by_id safely (handling empty strings or malformed UUIDs)
  BEGIN
    IF (NEW.raw_user_meta_data->>'managed_by_id') IS NOT NULL AND (NEW.raw_user_meta_data->>'managed_by_id') <> '' THEN
      m_id := (NEW.raw_user_meta_data->>'managed_by_id')::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    m_id := NULL;
  END;

  INSERT INTO public.users (
    id, 
    username, 
    password_hash, 
    role, 
    display_name,
    class,
    managed_by_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    'AUTH_MANAGED',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'class',
    m_id
  )
  ON CONFLICT (username) DO UPDATE SET
    -- DO NOT update ID here as it causes FK violations and crashes transactions
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    class = COALESCE(EXCLUDED.class, users.class), 
    role = COALESCE(EXCLUDED.role, users.role),
    managed_by_id = COALESCE(EXCLUDED.managed_by_id, users.managed_by_id),
    updated_at = now();

  -- 3. Ensure peripheral tables are initialized
  INSERT INTO public.user_room_data (user_id, placements, wall_placements, inventory, custom_catalog, custom_models, custom_walls, custom_floors, coins)
  VALUES (NEW.id, '[]'::jsonb, '[]'::jsonb, '["hk_stool", "hk_table", "hk_bed", "basement_stairs"]'::jsonb, '[]'::jsonb, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_avatar_config (user_id, equipped_items, custom_offsets)
  VALUES (NEW.id, '{"outfit": "default", "skin": "default"}'::jsonb, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2. Ensure only the correct trigger version is active
DROP TRIGGER IF EXISTS on_auth_user_sync ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_sync
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();
