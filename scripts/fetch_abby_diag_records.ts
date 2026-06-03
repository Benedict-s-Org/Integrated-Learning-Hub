import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchAbbyRecords() {
  console.log("Fetching Abby's records via diagnostic RPC...");
  const { data, error } = await supabase.rpc('get_abby_records');
  
  if (error) {
    console.error("Error calling get_abby_records:", error);
    return;
  }
  
  console.log(`Found ${data.length} records.`);
  console.table(data.slice(0, 20)); // Show top 20
  
  const total = data.reduce((sum: number, r: any) => sum + r.coin_amount, 0);
  const activeTotal = data.reduce((sum: number, r: any) => sum + (r.is_reverted ? 0 : r.coin_amount), 0);
  
  console.log(`Total coins (including reverted): ${total}`);
  console.log(`Active coins (non-reverted): ${activeTotal}`);
  
  const revertedCount = data.filter((r: any) => r.is_reverted).length;
  console.log(`Reverted records count: ${revertedCount}`);
}

fetchAbbyRecords();
