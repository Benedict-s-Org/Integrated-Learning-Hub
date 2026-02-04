-- Force seed regional data for existing regions
DO $$
DECLARE
    main_region_id UUID;
    light_region_id UUID;
BEGIN
    -- 1. Identify or Create "主城區"
    SELECT id INTO main_region_id FROM public.regions WHERE name = '主城區' LIMIT 1;
    
    IF main_region_id IS NOT NULL THEN
        -- Seed plots for 主城區 if empty
        IF NOT EXISTS (SELECT 1 FROM public.region_plots WHERE region_id = main_region_id) THEN
            INSERT INTO public.region_plots (region_id, position_x, position_y, plot_type)
            VALUES 
                (main_region_id, 2, 2, 'empty'),
                (main_region_id, 5, 3, 'empty'),
                (main_region_id, 3, 7, 'empty');
        END IF;

        -- Seed facility for 主城區 if empty
        IF NOT EXISTS (SELECT 1 FROM public.public_facilities WHERE region_id = main_region_id) THEN
            INSERT INTO public.public_facilities (region_id, facility_type, name, position_x, position_y)
            VALUES (main_region_id, 'school', '地區學院', 0, 0);
        END IF;
    END IF;

    -- 2. Identify or Create "光之國地區"
    SELECT id INTO light_region_id FROM public.regions WHERE name = '光之國地區' LIMIT 1;
    
    IF light_region_id IS NULL THEN
        INSERT INTO public.regions (name, grid_size, theme)
        VALUES ('光之國地區', 10, 'countryside')
        RETURNING id INTO light_region_id;
    END IF;

    -- Seed plots for 光之國地區 if empty
    IF NOT EXISTS (SELECT 1 FROM public.region_plots WHERE region_id = light_region_id) THEN
        INSERT INTO public.region_plots (region_id, position_x, position_y, plot_type)
        VALUES 
            (light_region_id, 1, 1, 'empty'),
            (light_region_id, 4, 4, 'empty'),
            (light_region_id, 8, 2, 'empty');
    END IF;

    -- Seed facility for 光之國地區 if empty
    IF NOT EXISTS (SELECT 1 FROM public.public_facilities WHERE region_id = light_region_id) THEN
        INSERT INTO public.public_facilities (region_id, facility_type, name, position_x, position_y)
        VALUES (light_region_id, 'park', '光之公園', 5, 5);
    END IF;

END $$;
