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
    const { data: acts, error: eq2 } = await supabase.from('activities').select('*');
    if (acts) console.log('Activities:', acts);

    // Find an admin by email
    const { data: admin } = await supabase.from('users').select('id, username').eq('role', 'admin').limit(1).single();
    console.log('Admin:', admin?.username);

    const { data: user } = await supabase.from('users').select('id, ecas, username').neq('role', 'admin').limit(1).single();
    console.log('User:', user?.username);

    if (admin && user) {
        console.log('Testing bulk-update-users...');
        const res = await supabase.functions.invoke('auth/bulk-update-users', {
            body: {
                adminUserId: admin.id,
                updates: [{ id: user.id, ecas: ['Cub Scouts'] }]
            }
        });
        console.log('Bulk update result:', JSON.stringify(res, null, 2));

        const { data: check } = await supabase.from('users').select('id, ecas').eq('id', user.id).single();
        console.log('User after update:', check);

        // cleanup
        await supabase.from('users').update({ ecas: user.ecas }).eq('id', user.id);
    }
}

test();
