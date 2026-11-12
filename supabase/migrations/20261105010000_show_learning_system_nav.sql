-- Show Learning System in the student nav when settings were saved before the item existed,
-- or were saved with the earlier default of hidden.

DO $$
DECLARE
  cfg jsonb;
  learning jsonb;
  i int;
  found boolean := false;
BEGIN
  SELECT value::jsonb INTO cfg
  FROM public.system_config
  WHERE key = 'navigation_settings';

  IF cfg IS NULL OR jsonb_typeof(cfg -> 'learning') <> 'array' THEN
    RETURN;
  END IF;

  learning := cfg -> 'learning';
  FOR i IN 0 .. jsonb_array_length(learning) - 1 LOOP
    IF learning -> i ->> 'id' = 'learningSystem' THEN
      learning := jsonb_set(learning, ARRAY[i::text, 'visible'], 'true'::jsonb, true);
      found := true;
    END IF;
  END LOOP;

  IF NOT found THEN
    learning := learning || jsonb_build_array(
      jsonb_build_object(
        'id', 'learningSystem',
        'label', 'Learning System',
        'visible', true
      )
    );
  END IF;

  UPDATE public.system_config
  SET value = jsonb_set(cfg, '{learning}', learning)::text
  WHERE key = 'navigation_settings';
END $$;
