-- Add rhythm config to exercises
ALTER TABLE public.cursive_exercises 
ADD COLUMN IF NOT EXISTS rhythm_config JSONB DEFAULT '{}'::JSONB;

-- rhythm_config structure:
-- {
--   "bpm": number,
--   "beatMarkers": number[], // Array of timestamps
--   "difficulty": "easy" | "normal" | "hard",
--   "approachRate": number, // ms
--   "pressure": {
--     "min": number,
--     "max": number,
--     "hardThreshold": number
--   }
-- }

-- Add detailed scoring to attempts
ALTER TABLE public.cursive_attempts 
ADD COLUMN IF NOT EXISTS rhythm_score JSONB DEFAULT '{}'::JSONB;

-- rhythm_score structure:
-- {
--   "perfectCount": number,
--   "greatCount": number,
--   "goodCount": number,
--   "missCount": number,
--   "maxCombo": number,
--   "totalScore": number,
--   "rank": "S" | "A" | "B" | "C" | "F",
--   "gentlePercent": number,
--   "coinsEarned": number
-- }
