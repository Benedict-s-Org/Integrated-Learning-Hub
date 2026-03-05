-- Add order_index column to classes and activities tables
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Optional: Initialize order_index based on name to keep current alphabetical order as default
-- This is just a helpful starting point.
WITH ordered_classes AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) - 1 as new_index
  FROM public.classes
)
UPDATE public.classes c
SET order_index = oc.new_index
FROM ordered_classes oc
WHERE c.id = oc.id;

WITH ordered_activities AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) - 1 as new_index
  FROM public.activities
)
UPDATE public.activities a
SET order_index = oa.new_index
FROM ordered_activities oa
WHERE a.id = oa.id;

-- Update the schema cache
NOTIFY pgrst, 'reload schema';
