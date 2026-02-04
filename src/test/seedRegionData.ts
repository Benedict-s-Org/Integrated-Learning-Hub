import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log('Starting seeding...');

    // Check if 光之國地區 exists
    const { data: existing, error: eError } = await supabase
        .from('regions')
        .select('id')
        .eq('name', '光之國地區')
        .maybeSingle();

    if (eError) {
        console.error('Check failed:', eError);
        return;
    }

    let regionId;
    if (!existing) {
        console.log('Creating region: 光之國地區');
        const { data: newRegion, error: rError } = await supabase
            .from('regions')
            .insert({ name: '光之國地區', grid_size: 10, theme: 'countryside' })
            .select()
            .single();

        if (rError) {
            console.error('Region creation failed:', rError);
            return;
        }
        regionId = newRegion.id;
    } else {
        console.log('Region 光之國地區 already exists');
        regionId = existing.id;
    }

    // Check if plots exist
    const { data: plots, error: pError } = await supabase
        .from('region_plots')
        .select('id')
        .eq('region_id', regionId);

    if (pError) {
        console.error('Check plots failed:', pError);
        return;
    }

    if (plots && plots.length === 0) {
        console.log('Seeding plots...');
        const { error: piError } = await supabase
            .from('region_plots')
            .insert([
                { region_id: regionId, position_x: 2, position_y: 2, plot_type: 'empty' },
                { region_id: regionId, position_x: 5, position_y: 3, plot_type: 'empty' },
                { region_id: regionId, position_x: 3, position_y: 7, plot_type: 'empty' }
            ]);
        if (piError) console.error('Plots seeding failed:', piError);
    }

    // Check if facilities exist
    const { data: facilities, error: fError } = await supabase
        .from('public_facilities')
        .select('id')
        .eq('region_id', regionId);

    if (fError) {
        console.error('Check facilities failed:', fError);
        return;
    }

    if (facilities && facilities.length === 0) {
        console.log('Seeding facilities...');
        const { error: fiError } = await supabase
            .from('public_facilities')
            .insert([
                { region_id: regionId, facility_type: 'school', name: '地區學院', position_x: 0, position_y: 0 }
            ]);
        if (fiError) console.error('Facilities seeding failed:', fiError);
    }

    console.log('Seeding complete!');
}

seed();
