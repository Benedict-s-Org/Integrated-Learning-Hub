import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkLog() {
    console.log("Checking student_records...");
    
    // Total count
    const { count, error: countError } = await supabase
        .from('student_records')
        .select('*', { count: 'exact', head: true });
    
    if (countError) {
        console.error("Count Error:", countError);
        return;
    }
    console.log(`Total records in student_records: ${count}`);

    // Check with the filter used in ProgressLog.tsx
    const { data, error: filterError } = await supabase
        .from('student_records')
        .select('id, coin_amount, message, assigned_at, is_reverted')
        .eq('is_reverted', false)
        .or('coin_amount.neq.0,message.ilike.%Toilet/Break%,assigned_at.is.not.null')
        .limit(5);

    if (filterError) {
        console.error("Filter Error:", filterError);
    } else {
        console.log(`Records matching filter: ${data?.length || 0}`);
        if (data && data.length > 0) {
            console.log("Sample records:", data);
        }
    }

    // Check without the filter
    const { data: allData, error: allDataError } = await supabase
        .from('student_records')
        .select('id, coin_amount, message, assigned_at, is_reverted')
        .limit(5);

    if (allDataError) {
        console.error("All Data Error:", allDataError);
    } else {
        console.log(`Sample of all records:`, allData);
    }
}

checkLog();
