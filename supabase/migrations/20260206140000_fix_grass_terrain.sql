-- 1. Update the check constraint to allow 'ground'
DO $$
BEGIN
    -- Drop the existing constraint
    ALTER TABLE city_style_assets DROP CONSTRAINT IF EXISTS city_style_assets_asset_type_check;
    
    -- Add updated constraint including 'ground'
    ALTER TABLE city_style_assets ADD CONSTRAINT city_style_assets_asset_type_check 
        CHECK (asset_type IN ('building', 'decoration', 'map_element', 'facility_visual', 'building_visual', 'ground'));
        
    RAISE NOTICE 'Updated check constraint to include "ground".';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating constraint: %', SQLERRM;
END $$;

-- 2. Logic to find '草地' (Grass), correct it, and set as default.
DO $$
DECLARE
    target_asset_id UUID;
BEGIN
    RAISE NOTICE 'Starting migration to set default grass terrain...';

    -- Reset all ground assets to not be default first (safety)
    UPDATE city_style_assets
    SET is_default = false
    WHERE asset_type = 'ground';

    -- Find the '草地' asset. 
    SELECT id INTO target_asset_id
    FROM city_style_assets
    WHERE (name = '草地' OR name ILIKE '%grass%')
    ORDER BY created_at DESC
    LIMIT 1;

    -- If found, update its type to 'ground' and set as default
    IF target_asset_id IS NOT NULL THEN
        UPDATE city_style_assets
        SET 
            asset_type = 'ground',
            is_default = true
        WHERE id = target_asset_id;
        
        RAISE NOTICE 'SUCCESS: Found asset % ("草地/Grass"). Updated to type="ground" and set as default.', target_asset_id;
    ELSE
        RAISE NOTICE 'WARNING: Could not find ANY asset named "草地" or "grass".';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Failed to set default terrain: %', SQLERRM;
END $$;
