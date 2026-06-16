const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const anonMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabaseUrl = urlMatch ? urlMatch[1] : '';
const anonKey = anonMatch ? anonMatch[1] : '';

const supabase = createClient(supabaseUrl, anonKey);

async function testAbsent() {
    // We need to use service role key to bypass RLS, or sign in as a teacher.
    // Let's use the service_role key to directly invoke the RPC if possible. Wait, RPC uses `auth.uid()` for authorization inside `is_authorized_for_class`.
    // If we use service role, `auth.uid()` is null, so it might fail.
    // We can't easily test without a teacher token.

    // Let's just check the database state for student 03 of Class Test
    const { data: users } = await supabase
        .from('users')
        .select('id, class_number, display_name')
        .eq('class', 'Class Test')
        .eq('class_number', '03');

    if (!users || users.length === 0) {
        console.log('User not found');
        return;
    }
    const student = users[0];
    
    // Check morning duty log
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
    const { data: log } = await supabase
        .from('morning_duty_logs')
        .select('*')
        .eq('student_id', student.id)
        .eq('log_date', today);

    console.log('Today log:', log);
    
    // Check coins in user_room_data
    const { data: roomData } = await supabase
        .from('user_room_data')
        .select('*')
        .eq('user_id', student.id);
        
    console.log('Room data:', roomData);
}

testAbsent();
