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
    const { count: userCount, error: userError } = await supabase.from('users').select('*', { count: 'exact', head: true });
    console.log('Total users in public.users:', userCount, userError || '');

    const { data: classes } = await supabase.from('classes').select('*');
    console.log('Classes:', classes);

    const { data: staffAssignments } = await supabase.from('class_staff_assignments').select('*');
    console.log('Staff Assignments:', staffAssignments);

    const { data: admins } = await supabase.from('users').select('id, username, role, class').eq('role', 'admin');
    console.log('Admins:', admins);

    const { data: staff } = await supabase.from('users').select('id, username, role, class').eq('role', 'class_staff');
    console.log('Staff:', staff);

    const { data: students } = await supabase.from('users').select('id, username, role, class').eq('role', 'user').limit(5);
    console.log('Sample Students:', students);

    // Test list-users invoke
    if (admins && admins.length > 0) {
        console.log('Invoking list-users for admin:', admins[0].username);
        const { data, error } = await supabase.functions.invoke('user-management/list-users', {
            body: { adminUserId: admins[0].id }
        });
        if (error) console.error('Invoke Error:', error);
        else console.log('Invoke Success, users count:', data?.users?.length);
    }
}

test();
