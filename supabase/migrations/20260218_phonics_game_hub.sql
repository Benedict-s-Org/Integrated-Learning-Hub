-- phonics_game_progress: Tracks overall user progress
CREATE TABLE IF NOT EXISTS phonics_game_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  xp_total INTEGER DEFAULT 0,
  level TEXT DEFAULT 'bronze',          -- bronze/silver/gold/platinum/diamond
  games_played INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_attempted INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  sounds_mastered TEXT[] DEFAULT '{}',  -- sound_codes the student has mastered
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- phonics_game_sessions: Logs individual game sessions
CREATE TABLE IF NOT EXISTS phonics_game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  game_mode TEXT NOT NULL,              -- 'sound_match' | 'speed_round' | 'pattern_hunt' | 'sound_sort'
  score INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  accuracy NUMERIC(5,2) DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  played_at TIMESTAMPTZ DEFAULT now()
);

-- phonics_badges: Definitions of earnable badges
CREATE TABLE IF NOT EXISTS phonics_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_key TEXT UNIQUE NOT NULL,       -- e.g., 'first_win', 'streak_10', 'master_vowels'
  badge_name TEXT NOT NULL,
  description TEXT,
  icon_name TEXT,                       -- lucide icon name
  unlock_condition JSONB,               -- e.g. {"type":"xp","threshold":100}
  tier TEXT DEFAULT 'bronze',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- phonics_user_badges: Junction table for earned badges
CREATE TABLE IF NOT EXISTS phonics_user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  badge_id UUID NOT NULL REFERENCES phonics_badges(id),
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Add RLS policies
ALTER TABLE phonics_game_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE phonics_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE phonics_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE phonics_user_badges ENABLE ROW LEVEL SECURITY;

-- Progress policies
CREATE POLICY "Users can view their own progress" ON phonics_game_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON phonics_game_progress
  FOR ALL USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert their own progress" ON phonics_game_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Session policies
CREATE POLICY "Users can view their own sessions" ON phonics_game_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON phonics_game_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Badge policies
CREATE POLICY "Everyone can view badge definitions" ON phonics_badges
  FOR SELECT USING (true);

-- User Badge policies
CREATE POLICY "Users can view their own badges" ON phonics_user_badges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own earned badges" ON phonics_user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seed some initial badges
INSERT INTO phonics_badges (badge_key, badge_name, description, icon_name, tier, unlock_condition)
VALUES
  ('first_steps', 'First Steps', 'Complete your first phonics game', 'Footprints', 'bronze', '{"type": "games_played", "threshold": 1}'),
  ('perfect_round', 'Perfect Round', 'Get 100% accuracy in a game', 'Star', 'silver', '{"type": "accuracy", "threshold": 100}'),
  ('streak_master', 'Streak Master', 'Achieve a streak of 10 or more', 'Flame', 'gold', '{"type": "streak", "threshold": 10}'),
  ('vowel_pro', 'Vowel Pro', 'Master all vowel sounds', 'Crown', 'platinum', '{"type": "mastery", "category": "vowel"}')
ON CONFLICT (badge_key) DO NOTHING;
