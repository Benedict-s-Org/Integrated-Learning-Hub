
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Searching for Abby and Ben in class 3A...");
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, username, display_name, class')
        .ilike('display_name', '%Abby%')
        .eq('class', '3A');

    const { data: benUsers, error: benError } = await supabase
        .from('users')
        .select('id, username, display_name, class')
        .ilike('display_name', '%Ben%')
        .eq('class', '3A');

    if (userError || benError) {
        console.error("User query error:", userError || benError);
        return;
    }

    const allAffected = [...(users || []), ...(benUsers || [])];
    console.log("Found students:", allAffected.length);
    
    for (const student of allAffected) {
        console.log(`\n--- ${student.display_name} (${student.id}) ---`);
        
        const { data: balance, error: balError } = await supabase
            .from('user_room_data')
            .select('coins, virtual_coins')
            .eq('user_id', student.id)
            .maybeSingle();
        
        console.log("Current Balance:", balance);

        const { data: records, error: recError } = await supabase
            .from('student_records')
            .select('coin_amount, is_virtual, message, created_at, is_reverted')
            .eq('student_id', student.id)
            .order('created_at', { ascending: false })
            .limit(10);

        console.log("Recent Student Records:", records);
        
        const { data: phonics, error: phError } = await supabase
            .from('phonics_game_sessions')
            .select('accuracy, xp_earned, played_at')
            .eq('user_id', student.id)
            .limit(5);
        
        console.log("Recent Phonics Sessions:", phonics);

        const { data: memo, error: memError } = await supabase
            .from('memorization_practice_sessions')
            .select('completed_at, hidden_words_count')
            .eq('user_id', student.id)
            .limit(5);

        console.log("Recent Memorization Sessions:", memo);
    }
}

run();
