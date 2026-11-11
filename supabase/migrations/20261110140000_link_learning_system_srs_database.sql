-- Point the hub Notion config at the Learning System SRS question bank.
UPDATE public.system_config
SET value = jsonb_set(
  value::jsonb,
  '{learning_system_srs_db_id}',
  to_jsonb('b9e05a5fd576487db54476387789d566'::text)
)::text
WHERE key = 'notion_database_ids';
