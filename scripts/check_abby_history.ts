import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ABBY_ID = 'a021ca6b-9ec5-492d-bd9d-eace437ae382';

async function checkRecords() {
  console.log("Checking Abby's records...");
  
  // Since we can't select directly due to RLS, let's see if there's a way to get them.
  // Actually, I can use the `get_user_coins_history` RPC if it exists.
  
  const { data, error } = await supabase.rpc('get_user_coins_history', { p_user_id: ABBY_ID });
  
  if (error) {
    console.log("RPC get_user_coins_history failed or doesn't exist. Trying another way...");
    // Let's try to search for other RPCs.
  } else {
    console.log("Abby's Record History:");
    console.table(data.slice(0, 20)); // Show first 20
    return;
  }
}

checkRecords();
