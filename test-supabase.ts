import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing URL or KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: users, error: eq } = await supabase.from('user_room_data').select('user_id, coins, virtual_coins, daily_counts');
    if (eq) console.log('Error', eq);

    if (users) {
        console.log('User counts:', users.length);
        console.log('Sample users:', users.slice(0, 3));
    }
}

test();
