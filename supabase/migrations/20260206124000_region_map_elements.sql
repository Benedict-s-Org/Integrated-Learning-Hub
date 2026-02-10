-- Create table for storing placed map elements in regions
CREATE TABLE IF NOT EXISTS region_map_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES public.city_style_assets(id) ON DELETE CASCADE,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    z_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_region_map_elements_region_id ON region_map_elements(region_id);

-- Enable RLS
ALTER TABLE region_map_elements ENABLE ROW LEVEL SECURITY;

-- Add policies (Assuming typical admin read/write, public read pattern)
DROP POLICY IF EXISTS "Public read access for map elements" ON region_map_elements;
CREATE POLICY "Public read access for map elements" ON region_map_elements
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin write access for map elements" ON region_map_elements;
CREATE POLICY "Admin write access for map elements" ON region_map_elements
    FOR ALL USING (auth.role() = 'service_role' OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Update city_asset_type check constraint to include map_element
DO $$
BEGIN
    -- Drop the existing constraint if it exists
    ALTER TABLE city_style_assets DROP CONSTRAINT IF EXISTS city_style_assets_asset_type_check;
    
    -- Add the updated constraint
    -- Inclusion of 'map_element' is critical for the new asset system
    ALTER TABLE city_style_assets ADD CONSTRAINT city_style_assets_asset_type_check 
        CHECK (asset_type IN ('building', 'decoration', 'map_element', 'facility_visual', 'building_visual'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not update constraint: %', SQLERRM;
END $$;
