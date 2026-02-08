-- Enable pgcrypto for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Create shared_links table for public access tokens
CREATE TABLE IF NOT EXISTS public.shared_links (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
    type text NOT NULL DEFAULT 'class_dashboard',
    description text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz, -- Optional expiry
    is_active boolean DEFAULT true
);

-- Enable RLS for shared_links
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

-- Admins can view/manage shared links
CREATE POLICY "Admins can manage shared links" ON public.shared_links
    FOR ALL TO authenticated
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' OR 
        (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    );

-- Create pending_rewards table for guest submissions
CREATE TABLE IF NOT EXISTS public.pending_rewards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    target_user_id uuid REFERENCES public.users(id) NOT NULL,
    amount integer NOT NULL,
    reason text,
    submitted_by_token text REFERENCES public.shared_links(token), -- Track which link was used
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at timestamptz DEFAULT now(),
    processed_at timestamptz,
    processed_by uuid REFERENCES auth.users(id)
);

-- Enable RLS for pending_rewards
ALTER TABLE public.pending_rewards ENABLE ROW LEVEL SECURITY;

-- Admins can view/manage pending rewards
CREATE POLICY "Admins can manage pending rewards" ON public.pending_rewards
    FOR ALL TO authenticated
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin' OR 
        (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
    );

-- Grant access to service_role for Edge Functions
GRANT ALL ON TABLE public.shared_links TO service_role;
GRANT ALL ON TABLE public.pending_rewards TO service_role;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_rewards_status ON public.pending_rewards(status);
CREATE INDEX IF NOT EXISTS idx_shared_links_token ON public.shared_links(token);
