-- Create regions table
CREATE TABLE IF NOT EXISTS public.regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    grid_size INTEGER NOT NULL DEFAULT 10,
    theme TEXT NOT NULL DEFAULT 'countryside',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for regions
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to regions" ON public.regions FOR SELECT USING (true);

-- Create region_plots table
CREATE TABLE IF NOT EXISTS public.region_plots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    position_x INTEGER NOT NULL,
    position_y INTEGER NOT NULL,
    size_width INTEGER NOT NULL DEFAULT 1,
    size_depth INTEGER NOT NULL DEFAULT 1,
    plot_type TEXT NOT NULL DEFAULT 'empty',
    city_level INTEGER,
    city_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for region_plots
ALTER TABLE public.region_plots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to region_plots" ON public.region_plots FOR SELECT USING (true);
CREATE POLICY "Allow users to update their own plots" ON public.region_plots 
    FOR UPDATE USING (auth.uid() = owner_id);

-- Create public_facilities table
CREATE TABLE IF NOT EXISTS public.public_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
    plot_id UUID REFERENCES public.region_plots(id) ON DELETE SET NULL,
    facility_type TEXT NOT NULL,
    name TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    position_x INTEGER NOT NULL,
    position_y INTEGER NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for public_facilities
ALTER TABLE public.public_facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to public_facilities" ON public.public_facilities FOR SELECT USING (true);

-- Seed initial data
DO $$
DECLARE
    region_id UUID;
    plot1_id UUID;
    plot2_id UUID;
BEGIN
    -- Only insert if empty
    IF NOT EXISTS (SELECT 1 FROM public.regions) THEN
        INSERT INTO public.regions (name, grid_size, theme)
        VALUES ('光之國地區', 10, 'countryside')
        RETURNING id INTO region_id;

        -- Insert some empty plots
        INSERT INTO public.region_plots (region_id, position_x, position_y, plot_type)
        VALUES (region_id, 2, 2, 'empty') RETURNING id INTO plot1_id;
        
        INSERT INTO public.region_plots (region_id, position_x, position_y, plot_type)
        VALUES (region_id, 5, 3, 'empty') RETURNING id INTO plot2_id;

        INSERT INTO public.region_plots (region_id, position_x, position_y, plot_type)
        VALUES (region_id, 3, 7, 'empty');

        -- Insert a public facility
        INSERT INTO public.public_facilities (region_id, plot_id, facility_type, name, position_x, position_y)
        VALUES (region_id, NULL, 'school', '地區學院', 0, 0);
    END IF;
END $$;
