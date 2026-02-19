-- Add order_index column to spaced_repetition_questions
ALTER TABLE spaced_repetition_questions ADD COLUMN IF NOT EXISTS order_index integer;

-- Initialize order_index based on created_at for existing questions
WITH ranked_questions AS (
  SELECT id, row_number() OVER (PARTITION BY set_id ORDER BY created_at ASC) - 1 as rank
  FROM spaced_repetition_questions
)
UPDATE spaced_repetition_questions
SET order_index = ranked_questions.rank
FROM ranked_questions
WHERE spaced_repetition_questions.id = ranked_questions.id;

-- Make order_index required for future inserts
-- ALTER TABLE spaced_repetition_questions ALTER COLUMN order_index SET NOT NULL;
