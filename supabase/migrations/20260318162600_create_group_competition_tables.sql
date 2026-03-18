
-- Create Group Competition tables

CREATE TABLE IF NOT EXISTS public.group_competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
    game_type TEXT NOT NULL DEFAULT 'racing',
    group_scores JSONB NOT NULL DEFAULT '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_competitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Hosts can manage their own competitions" 
ON public.group_competitions 
FOR ALL USING (auth.uid() = host_id);

CREATE POLICY "Anyone can view competitions" 
ON public.group_competitions 
FOR SELECT USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_competitions;
