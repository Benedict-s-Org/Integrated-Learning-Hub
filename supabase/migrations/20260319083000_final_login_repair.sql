-- Migration: Final Login Repair & Sync Fail-safe
-- Description: Fixes type mismatch (JSONB vs TEXT[]) and adds error handling to sync trigger to prevent login blocking.

-- 1. Ensure password_hash is nullable (Supabase Auth doesn't provide it)
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- 2. Redefine the sync function with intense robustness
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

  -- B. Upsert into public.users
  -- Wrapped in BEGIN/EXCEPTION so a failure here DOES NOT block login
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- Log to postgres stderr (visible in Supabase logs)
    RAISE LOG '[handle_new_auth_user] Critical Error syncing user %: %', NEW.id, SQLERRM;
  END;

  -- C. Initialize peripheral tables
  -- Wrapped separately to isolate failures
  BEGIN
    -- 1. user_room_data (FIX: Use Postgres Array literal instead of JSONB for inventory)
    INSERT INTO public.user_room_data (
      user_id, 
      placements, 
      wall_placements, 
      inventory, 
      custom_catalog, 
      custom_models, 
      custom_walls, 
      custom_floors, 
      coins
    )
    VALUES (
      NEW.id, 
      '[]'::jsonb, 
      '[]'::jsonb, 
      ARRAY['hk_stool', 'hk_table', 'hk_bed', 'basement_stairs'], -- CORRECT: Postgres TEXT[] array
      '[]'::jsonb, 
      '{}'::jsonb, 
      '[]'::jsonb, 
      '[]'::jsonb, 
      0
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- 2. user_avatar_config
    INSERT INTO public.user_avatar_config (user_id, equipped_items, custom_offsets)
    VALUES (NEW.id, '{"outfit": "default", "skin": "default"}'::jsonb, '{}'::jsonb)
    ON CONFLICT (user_id) DO NOTHING;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG '[handle_new_auth_user] Critical Error initializing peripheral tables for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 3. Ensure the trigger is active
DROP TRIGGER IF EXISTS on_auth_user_sync ON auth.users;
CREATE TRIGGER on_auth_user_sync
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();
