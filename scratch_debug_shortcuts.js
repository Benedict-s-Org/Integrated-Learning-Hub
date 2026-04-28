
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log('--- Checking dashboard_shortcuts ---');
    const { data: shortcuts, error: sError } = await supabase
        .from('dashboard_shortcuts')
        .select('*');
    
    if (sError) console.error('Shortcuts error:', sError);
    else console.log('Shortcuts:', JSON.stringify(shortcuts, null, 2));

    console.log('\n--- Checking user 3a@superleekam.edu.hk ---');
    const { data: users, error: uError } = await supabase
        .from('users')
        .select('id, username, display_name, role, class')
        .eq('username', '3a@superleekam.edu.hk');
    
    if (uError) console.error('User error:', uError);
    else console.log('User:', JSON.stringify(users, null, 2));
}

debug();
