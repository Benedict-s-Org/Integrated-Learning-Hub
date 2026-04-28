import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!; // Or service role if needed
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    console.log("Checking user_room_data...");
    const { data, error } = await supabase
        .from('user_room_data')
        .select('user_id, morning_status, last_morning_update')
        .limit(5);
    
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    console.log("Data sample:", JSON.stringify(data, null, 2));
    
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
    console.log("Today (HK):", today);
}

checkUsers();
