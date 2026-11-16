ALTER TABLE public.spelling_practices
  ADD COLUMN IF NOT EXISTS word_audio jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_accent text NULL,
  ADD COLUMN IF NOT EXISTS audio_voice_name text NULL;

COMMENT ON COLUMN public.spelling_practices.word_audio IS
  'Per-word Drive TTS bindings: [{word, drive_file_id, accent, voice_name}]';