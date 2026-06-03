import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ABBY_ID = 'a021ca6b-9ec5-492d-bd9d-eace437ae382';

async function checkAbby() {
  // Since we can't bypass RLS with anon key for other users,
  // we check if we can at least see the public stats or if there's an RPC.
  
  console.log("Checking Abby's stats via RPC...");
  const { data, error } = await supabase.rpc('get_class_coin_stats', { p_class_name: '3A' });
  
  if (error) {
    console.error("Error calling RPC:", error);
    return;
  }
  
  const abby = data.find((s: any) => s.actual_user_id === ABBY_ID);
  if (abby) {
    console.log("Abby's Stats:", JSON.stringify(abby, null, 2));
  } else {
    console.log("Abby not found in 3A stats.");
  }
}

checkAbby();
