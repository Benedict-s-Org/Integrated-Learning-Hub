import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function reset() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
  const todayIsoStart = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' }) + 'T00:00:00.000Z';
  
  console.log('Fetching Test users...');
  const { data: users, error: usersErr } = await supabase.from('users').select('id').ilike('class', 'Test');
  if (usersErr) throw usersErr;
  
  const userIds = users.map(u => u.id);
  console.log(`Found ${userIds.length} users in Test class.`);
  
  if (userIds.length > 0) {
      console.log('Resetting user_room_data...');
      for (const id of userIds) {
          await supabase.from('user_room_data').update({
              coins: 0,
              virtual_coins: 0,
              daily_counts: {},
              morning_status: 'todo'
          }).eq('user_id', id);
      }
      
      console.log('Deleting morning_duty_logs...');
      await supabase.from('morning_duty_logs').delete().eq('log_date', today).in('student_id', userIds);
      
      console.log('Deleting student_records...');
      await supabase.from('student_records').delete().gte('created_at', todayIsoStart).in('student_id', userIds);
      
      console.log('Deleting coin_transactions...');
      await supabase.from('coin_transactions').delete().gte('created_at', todayIsoStart).in('user_id', userIds);
  }
  
  console.log('Deleting daily_homework...');
  await supabase.from('daily_homework').delete().eq('date', today).ilike('class_name', 'Test');
  
  console.log('Done!');
}

reset().catch(console.error);
