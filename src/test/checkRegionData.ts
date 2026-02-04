import { createClient } from '@supabase/supabase-js';
console.log('Script started');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking Regions...');
    const { data: regions, error: rError } = await supabase.from('regions').select('*');
    console.log('Regions:', regions);
    if (rError) console.error('Regions Error:', rError);

    if (regions && regions.length > 0) {
        const regionId = regions[0].id;
        console.log(`Checking Plots for region ${regionId}...`);
        const { data: plots, error: pError } = await supabase.from('region_plots').select('*').eq('region_id', regionId);
        console.log('Plots:', plots);
        if (pError) console.error('Plots Error:', pError);

        console.log(`Checking Facilities for region ${regionId}...`);
        const { data: facilities, error: fError } = await supabase.from('public_facilities').select('*').eq('region_id', regionId);
        console.log('Facilities:', facilities);
        if (fError) console.error('Facilities Error:', fError);
    } else {
        console.log('No regions found to check plots/facilities');
    }
}

try {
    await checkData();
    process.exit(0);
} catch (err) {
    console.error('Unhandled error:', err);
    process.exit(1);
}
