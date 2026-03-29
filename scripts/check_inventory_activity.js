
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking recent inventory activity...");
    const { data: inventory, error: invError } = await supabase
        .from('user_avatar_inventory')
        .select('user_id, item_id, acquired_at, source')
        .order('acquired_at', { ascending: false })
        .limit(20);

    if (invError) {
        console.error("Inventory query error:", invError);
        return;
    }

    console.table(inventory);
}

run();
