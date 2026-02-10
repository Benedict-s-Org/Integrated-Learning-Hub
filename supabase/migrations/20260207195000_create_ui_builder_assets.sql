-- Create UI Builder Assets Table
CREATE TABLE IF NOT EXISTS public.ui_builder_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('image', 'document', 'data')),
    metadata jsonb NOT NULL DEFAULT '{}',
    storage_path text NOT NULL,
    public_url text NOT NULL,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.ui_builder_assets ENABLE ROW LEVEL SECURITY;

-- Policies for ui_builder_assets
DROP POLICY IF EXISTS "Admins can view UI assets" ON public.ui_builder_assets;
CREATE POLICY "Admins can view UI assets" ON public.ui_builder_assets
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can insert UI assets" ON public.ui_builder_assets;
CREATE POLICY "Admins can insert UI assets" ON public.ui_builder_assets
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can delete UI assets" ON public.ui_builder_assets;
CREATE POLICY "Admins can delete UI assets" ON public.ui_builder_assets
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Note: Storage bucket creation usually happens via Dashboard or Admin API, 
-- but we can document the intent here. 
-- The bucket 'ui-assets' should be created manually or via CLI if not present.
