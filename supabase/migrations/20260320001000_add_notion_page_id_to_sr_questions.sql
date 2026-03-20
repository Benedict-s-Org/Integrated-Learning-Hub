-- Add notion_page_id to spaced_repetition_questions
-- This allows referring back to the original Notion page for elaboration requests

ALTER TABLE spaced_repetition_questions
  ADD COLUMN IF NOT EXISTS notion_page_id TEXT;

COMMENT ON COLUMN spaced_repetition_questions.notion_page_id IS
  'The Notion page ID this question was imported from, used for elaboration requests';
