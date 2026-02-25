-- Repair Users Schema
-- Adds missing columns that were expected by backend functions but missing in the physical table.

DO $$ 
BEGIN
    -- Add can_access_learning_hub if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_access_learning_hub') THEN
        ALTER TABLE public.users ADD COLUMN can_access_learning_hub boolean DEFAULT false;
    END IF;

    -- Add can_access_proofreading if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_access_proofreading') THEN
        ALTER TABLE public.users ADD COLUMN can_access_proofreading boolean DEFAULT false;
    END IF;

    -- Add can_access_spelling if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_access_spelling') THEN
        ALTER TABLE public.users ADD COLUMN can_access_spelling boolean DEFAULT false;
    END IF;

    -- Add class if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'class') THEN
        ALTER TABLE public.users ADD COLUMN class text DEFAULT NULL;
    END IF;

    -- Add seat_number if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'seat_number') THEN
        ALTER TABLE public.users ADD COLUMN seat_number integer DEFAULT NULL;
    END IF;
    -- spelling_level
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'spelling_level') THEN
        ALTER TABLE public.users ADD COLUMN spelling_level integer;
    END IF;

    -- managed_by_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'managed_by_id') THEN
        ALTER TABLE public.users ADD COLUMN managed_by_id uuid REFERENCES public.users(id);
    END IF;
END $$;

-- Re-apply create_user_with_password to ensure it matches the final schema
CREATE OR REPLACE FUNCTION create_user_with_password(
  username_input text DEFAULT NULL,
  password_input text DEFAULT NULL,
  role_input text DEFAULT 'user',
  display_name_input text DEFAULT NULL,
  can_access_proofreading_input boolean DEFAULT false,
  can_access_spelling_input boolean DEFAULT false,
  can_access_learning_hub_input boolean DEFAULT false,
  class_input text DEFAULT NULL,
  managed_by_id_input uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  new_user_id uuid;
  new_user json;
  final_username text;
  final_password text;
  final_display_name text;
BEGIN
  -- Handle missing or null username
  final_username := COALESCE(username_input, 'user_' || substr(md5(random()::text), 1, 8));
  
  -- Handle missing or null password
  final_password := COALESCE(password_input, '123456');

  -- Use username as display_name if not provided
  final_display_name := COALESCE(NULLIF(display_name_input, ''), final_username);

  INSERT INTO public.users (
    username,
    password_hash,
    role,
    display_name,
    can_access_proofreading,
    can_access_spelling,
    can_access_learning_hub,
    class,
    managed_by_id
  )
  VALUES (
    final_username,
    crypt(final_password, gen_salt('bf')),
    COALESCE(role_input, 'user'),
    final_display_name,
    COALESCE(can_access_proofreading_input, false),
    COALESCE(can_access_spelling_input, false),
    COALESCE(can_access_learning_hub_input, false),
    class_input,
    managed_by_id_input
  )
  RETURNING id INTO new_user_id;

  SELECT json_build_object(
    'id', id,
    'username', username,
    'role', role,
    'display_name', display_name,
    'class', class,
    'created_at', created_at
  ) INTO new_user
  FROM public.users
  WHERE id = new_user_id;

  RETURN new_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
