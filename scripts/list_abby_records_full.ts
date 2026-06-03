import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchAbbyRecords() {
  const { data, error } = await supabase.rpc('get_abby_records');
  if (error) return;
  
  console.log("Abby's Records (ALL):");
  const simplified = data.map((r: any) => ({
    message: r.message,
    amount: r.coin_amount,
    reverted: r.is_reverted,
    date: r.created_at
  }));
  console.log(JSON.stringify(simplified, null, 2));
}

fetchAbbyRecords();
