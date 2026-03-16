-- Migration: Fix Auth Sync Trigger (Final Fix - Re-attempt)
-- Description: Fixes TG_OP syntax error and optimizes trigger to avoid secondary trigger collisions.
-- This version uses separate triggers for INSERT and UPDATE to properly handle WHEN clauses.

-- 1. Redefine the function with defensive logic and safety checks
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  m_id uuid;
  existing_id uuid;
BEGIN
  -- A. Defensive Check: Does user already exist in public.users?
  -- We search by username (email) as it's the most reliable secondary key.
  SELECT id INTO existing_id FROM public.users WHERE username = NEW.email;

  IF existing_id IS NOT NULL THEN
    -- B. Update existing record if found. 
    -- We do NOT update the ID here to avoid FK violations.
    UPDATE public.users SET
      display_name = COALESCE(NEW.raw_user_meta_data->>'display_name', users.display_name),
      class = COALESCE(NEW.raw_user_meta_data->>'class', users.class), 
      role = COALESCE(NEW.raw_user_meta_data->>'role', users.role, 'user'),
      updated_at = now()
    WHERE id = existing_id;
  ELSE
    -- C. INSERT new record if user doesn't exist.
    -- Parse managed_by_id safely
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
    ON CONFLICT (username) DO NOTHING;
  END IF;

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

-- 2. Cleanup old triggers
DROP TRIGGER IF EXISTS on_auth_user_sync ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Trigger for NEW users (always fires on registration)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

-- 4. Trigger for UPDATED users (only fires if important fields change)
-- This avoids firing on every login (which updates last_sign_in_at)
CREATE TRIGGER on_auth_user_sync
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (
    OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data OR 
    OLD.email IS DISTINCT FROM NEW.email
  )
  EXECUTE FUNCTION handle_new_auth_user();
