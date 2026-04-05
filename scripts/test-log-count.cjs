const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLog() {
    console.log("Checking student_records table content...");
    
    // 1. All columns check (get one record)
    const { data: sample, error: sampleError } = await supabase
        .from('student_records')
        .select('*')
        .limit(1);
    
    if (sampleError) {
        console.error("Sample Error:", sampleError);
    } else if (sample && sample.length > 0) {
        console.log("Columns found in student_records:", Object.keys(sample[0]));
    } else {
        console.log("Table student_records is EMPTY.");
        return;
    }

    // 2. Count total
    const { count, error: countError } = await supabase
        .from('student_records')
        .select('*', { count: 'exact', head: true });
    console.log(`Total records: ${count}`);

    // 3. Count matching the ProgressLog filter
    const { count: filteredCount, error: filteredError } = await supabase
        .from('student_records')
        .select('*', { count: 'exact', head: true })
        .or('coin_amount.neq.0,message.ilike.%Toilet/Break%,assigned_at.is.not.null');
    
    console.log(`Records matching ProgressLog filter: ${filteredCount}`);

    // 4. Show last 5 records
    const { data: last5, error: lastError } = await supabase
        .from('student_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
    
    console.log("Last 5 records:", JSON.stringify(last5, null, 2));
}

checkLog();
