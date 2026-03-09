-- Migration: Add notion_database_id to spaced_repetition_sets
-- Description: Allows referring clarification/elaboration requests back to the source Notion database.

ALTER TABLE "public"."spaced_repetition_sets" 
ADD COLUMN IF NOT EXISTS "notion_database_id" text;

COMMENT ON COLUMN "public"."spaced_repetition_sets"."notion_database_id" IS 'The ID of the Notion database this set was imported from.';
