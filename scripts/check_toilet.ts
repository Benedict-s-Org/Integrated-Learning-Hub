import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkToiletCoins() {
  const students = [
    { name: 'Abby', id: 'a021ca6b-9ec5-492d-bd9d-eace437ae382' },
    { name: 'Ben', id: '656c89ec-0c5a-40da-819f-f4fd044916d4' }
  ];

  for (const s of students) {
    console.log(`\n--- Toilet Stats for ${s.name} ---`);
    
    // 1. Current toilet_coins
    const { data: room } = await supabase.from('user_room_data').select('toilet_coins').eq('user_id', s.id).single();
    
    // 2. Count of Toilet/Break in student_records
    const { count: toiletCount } = await supabase
        .from('student_records')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', s.id)
        .eq('message', 'Toilet/Break');
    
    console.log(`Current Toilet Coins Displayed: ${room?.toilet_coins ?? 100}`);
    console.log(`Audited Toilet Breaks in Logs: ${toiletCount || 0}`);
    console.log(`Estimated Toilet Balance (100 - Breaks*20): ${100 - (toiletCount || 0) * 20}`);
  }
}

checkToiletCoins();
