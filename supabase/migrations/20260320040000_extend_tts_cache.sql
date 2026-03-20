-- Migration: Extend tts_cache for full cache granularity
-- Adds voice_name and speaking_rate columns so that different voice/speed
-- combinations produce separate cache entries.

-- 1. Add new nullable columns
ALTER TABLE tts_cache
  ADD COLUMN IF NOT EXISTS voice_name TEXT,
  ADD COLUMN IF NOT EXISTS speaking_rate NUMERIC;

-- 2. Backfill existing rows with current defaults
UPDATE tts_cache
SET voice_name   = 'en-GB-Neural2-B',
    speaking_rate = 0.9
WHERE voice_name IS NULL
   OR speaking_rate IS NULL;

-- 3. Make columns NOT NULL after backfill
ALTER TABLE tts_cache
  ALTER COLUMN voice_name SET NOT NULL,
  ALTER COLUMN speaking_rate SET NOT NULL;

-- 4. Set defaults for future inserts
ALTER TABLE tts_cache
  ALTER COLUMN voice_name SET DEFAULT 'en-GB-Neural2-B',
  ALTER COLUMN speaking_rate SET DEFAULT 0.9;

-- 5. Drop old unique constraint if it exists (text, accent only)
--    Using DO block to handle case where constraint doesn't exist
DO $$
DECLARE
  _cname TEXT;
BEGIN
  SELECT conname INTO _cname
  FROM pg_constraint
  WHERE conrelid = 'tts_cache'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 2
  LIMIT 1;

  IF _cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tts_cache DROP CONSTRAINT %I', _cname);
  END IF;
END $$;

-- 6. Add new unique constraint on the full cache key
ALTER TABLE tts_cache
  ADD CONSTRAINT tts_cache_text_accent_voice_speaking_unique
  UNIQUE (text, accent, voice_name, speaking_rate);

-- 7. Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_tts_cache_lookup
  ON tts_cache (text, accent, voice_name, speaking_rate);
