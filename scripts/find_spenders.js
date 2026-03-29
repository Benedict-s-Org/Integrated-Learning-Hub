
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Searching for students with non-default inventory or house upgrades...");
    const { data: rooms, error: roomError } = await supabase
        .from('user_room_data')
        .select('user_id, inventory, house_level, coins')
        .or('house_level.gt.0,inventory.neq.{}')
        .limit(20);

    if (roomError) {
        console.error("Query error:", roomError);
        return;
    }

    console.table(rooms.map(r => ({
        user_id: r.user_id,
        inventory_count: r.inventory ? r.inventory.length : 0,
        house_level: r.house_level,
        coins: r.coins
    })));
}

run();
