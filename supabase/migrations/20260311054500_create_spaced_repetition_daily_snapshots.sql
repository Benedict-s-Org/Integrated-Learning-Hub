-- Create the spaced_repetition_daily_snapshots table
CREATE TABLE IF NOT EXISTS public.spaced_repetition_daily_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    plan_id TEXT NOT NULL, -- UUID of assignment, template, or a hash representing selected sets
    snapshot_date DATE NOT NULL,
    unseen_count INTEGER NOT NULL DEFAULT 0,
    review_today_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    mastered_count INTEGER NOT NULL DEFAULT 0,
    computed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Ensure only one snapshot per user, per plan context, per day
    UNIQUE(user_id, plan_id, snapshot_date)
);

-- Turn on RLS
ALTER TABLE public.spaced_repetition_daily_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own snapshots" 
    ON public.spaced_repetition_daily_snapshots FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own snapshots" 
    ON public.spaced_repetition_daily_snapshots FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own snapshots" 
    ON public.spaced_repetition_daily_snapshots FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own snapshots" 
    ON public.spaced_repetition_daily_snapshots FOR DELETE 
    USING (auth.uid() = user_id);

