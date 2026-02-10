-- Recovery migration for missing city_style_assets table
CREATE TABLE IF NOT EXISTS public.city_style_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.city_style_assets ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to city_style_assets"
    ON public.city_style_assets FOR SELECT
    USING (true);
