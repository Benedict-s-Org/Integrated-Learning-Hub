-- Migration: Fix Auth Sync Trigger (ID-First Matching)
-- Description: Prioritizes matching by internal UUID (id) over email (username) to handle email changes safely.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  m_id uuid;
  existing_user public.users%ROWTYPE;
BEGIN
  -- 1. Search by ID first (primary source of truth)
  SELECT * INTO existing_user FROM public.users WHERE id = NEW.id;

  IF existing_user.id IS NOT NULL THEN
    -- A. Update existing record by ID
    UPDATE public.users SET
      username = NEW.email, -- Update email if it changed
      display_name = COALESCE(NEW.raw_user_meta_data->>'display_name', users.display_name),
      class = COALESCE(NEW.raw_user_meta_data->>'class', users.class), 
      role = COALESCE(NEW.raw_user_meta_data->>'role', users.role, 'user'),
      updated_at = now()
    WHERE id = NEW.id;
  ELSE
    -- B. If not found by ID, check if the email (username) is taken by another ID
    -- This handles edge cases where a user might have been manually created with the same email
    IF EXISTS (SELECT 1 FROM public.users WHERE username = NEW.email) THEN
       -- Update the existing record that has this email but a different ID 
       -- (Dangerous, usually we skip or log, but here we'll try to sync IDs if email is intended for this user)
       UPDATE public.users SET
         id = NEW.id,
         display_name = COALESCE(NEW.raw_user_meta_data->>'display_name', users.display_name),
         updated_at = now()
       WHERE username = NEW.email;
    ELSE
      -- C. INSERT new record
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
      );
    END IF;
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
