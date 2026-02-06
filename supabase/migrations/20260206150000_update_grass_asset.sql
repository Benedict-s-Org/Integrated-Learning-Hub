DO $$
DECLARE
    target_asset_id UUID;
BEGIN
    -- Find the default 'ground' asset (which should be the grass we set earlier)
    SELECT id INTO target_asset_id
    FROM city_style_assets
    WHERE asset_type = 'ground' AND is_default = true
    LIMIT 1;

    -- If not found, try finding by name '草地'
    IF target_asset_id IS NULL THEN
        SELECT id INTO target_asset_id
        FROM city_style_assets
        WHERE name = '草地'
        LIMIT 1;
    END IF;

    -- Update the asset URL
    IF target_asset_id IS NOT NULL THEN
        UPDATE city_style_assets
        SET image_url = '/assets/grass_v2.png'
        WHERE id = target_asset_id;
        
        RAISE NOTICE 'SUCCESS: Updated asset % URL to /assets/grass_v2.png', target_asset_id;
    ELSE
        RAISE NOTICE 'WARNING: Could not find "草地" asset to update.';
    END IF;
END $$;
