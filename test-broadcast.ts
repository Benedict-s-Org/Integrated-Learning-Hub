import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'dummy'; // Will use service role below
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    const { data, error } = await supabaseAdmin
        .from('system_config')
        .select('value')
        .eq('key', 'broadcast_v2_settings')
        .maybeSingle();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(JSON.stringify(JSON.parse(data?.value || '{}'), null, 2));
    }
}

main();
