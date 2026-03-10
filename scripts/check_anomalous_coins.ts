import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Or better, let's use the node script running against supabase.
// Since anon key might be blocked by RLS for querying all users, let's check.
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchAll(table) {
    let allData = [];
    let start = 0;
    const limit = 1000;
    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(start, start + limit - 1)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(`${table} error:`, error.message);
            break;
        }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < limit) break;
        start += limit;
    }
    return allData;
}

async function checkAnomalousRecords() {
    console.log("Fetching anomalous records via RPC...");
    const { data, error } = await supabase.rpc('get_anomalous_coin_records');

    if (error) {
        console.error("RPC Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No anomalies found by RPC!");
    } else {
        console.log(`Found ${data.length} anomalies:`);
        console.dir(data, { depth: null });
    }
}

checkAnomalousRecords();
