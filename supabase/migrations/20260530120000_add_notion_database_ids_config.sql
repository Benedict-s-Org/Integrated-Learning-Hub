-- Seed new Notion database configuration keys into the system_config table
INSERT INTO public.system_config (key, value)
VALUES (
  'notion_database_ids',
  '{"reading_comprehension_db_id": "3249baca6fa3802ea86ec9921032c29b", "reading_pdfs_db_id": "3239baca6fa380a9b501deceb133946d", "cycle_day_db_id": "2579baca6fa3806f9c6ef193f7d81213", "proofreading_db_id": "7f81157c-0c29-440a-b35f-df4bc862fbc1", "anagram_bank_db_id": "d7ea40d03cde4e54b8a6226ac75130cc", "anagram_runs_db_id": "9e203ecf9a7946cc8051f0b59329620f", "anagram_responses_db_id": "e6d90d25cb7d4ee8938f2e2c61a93d38", "help_db_id": "2647f405a5a14e9fa6660dc164a3e502"}'
)
ON CONFLICT (key) DO NOTHING;
