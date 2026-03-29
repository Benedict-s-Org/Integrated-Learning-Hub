
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Listing all users...");
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, display_name, class')
        .limit(100);

    if (userError) {
        console.error("User query error:", userError);
        return;
    }

    console.table(users);
}

run();
