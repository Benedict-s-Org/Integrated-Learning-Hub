
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Searching for negative coin records...");
    const { data: records, error: recError } = await supabase
        .from('student_records')
        .select('student_id, coin_amount, message, created_at, is_virtual')
        .eq('type', 'negative')
        .order('created_at', { ascending: false })
        .limit(50);

    if (recError) {
        console.error("Query error:", recError);
        return;
    }

    console.log(`Found ${records.length} negative records.`);
    console.table(records);
}

run();
