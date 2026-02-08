-- Create table for tracking coin history
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id), -- Admin who gave the coins
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for preset target behaviors
CREATE TABLE IF NOT EXISTS public.target_behaviors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    icon TEXT, -- Lucide icon name or emoji
    coin_value INTEGER NOT NULL DEFAULT 1,
    category TEXT DEFAULT 'general',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_behaviors ENABLE ROW LEVEL SECURITY;

-- Policies for coin_transactions
-- Admins can view all transactions
CREATE POLICY "Admins can view all coin transactions"
    ON public.coin_transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Users can view their own transactions
CREATE POLICY "Users can view their own coin transactions"
    ON public.coin_transactions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can insert transactions (award coins)
CREATE POLICY "Admins can insert coin transactions"
    ON public.coin_transactions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Policies for target_behaviors
-- Everyone can view active behaviors (for display)
CREATE POLICY "Everyone can view active target behaviors"
    ON public.target_behaviors
    FOR SELECT
    USING (true);

-- Only admins can manage behaviors
CREATE POLICY "Admins can manage target behaviors"
    ON public.target_behaviors
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Insert some default behaviors
INSERT INTO public.target_behaviors (label, icon, coin_value, category) VALUES
('Excellent Participation', 'Star', 5, 'Participation'),
('Helping Others', 'HandHeart', 10, 'Social'),
('Homework Completion', 'BookCheck', 5, 'Academic'),
('Insightful Question', 'Lightbulb', 3, 'Academic'),
('Perfect Attendance', 'CalendarCheck', 5, 'Attendance'),
('Positive Attitude', 'Smile', 2, 'Behavior');
