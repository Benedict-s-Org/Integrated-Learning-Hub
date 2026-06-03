import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ABBY_ID = 'a021ca6b-9ec5-492d-bd9d-eace437ae382';

async function runRebuild() {
  console.log(`Running rebuild_user_balances for Abby (${ABBY_ID})...`);
  
  const { error } = await supabase.rpc('rebuild_user_balances', { p_user_id: ABBY_ID });
  
  if (error) {
    console.error("Error during rebuild:", error);
    return;
  }
  
  console.log("Rebuild complete. Checking new balance...");
  
  const { data: stats, error: statsError } = await supabase.rpc('get_class_coin_stats', { p_class_name: '3A' });
  const abby = stats.find((s: any) => s.actual_user_id === ABBY_ID);
  
  if (abby) {
    console.log("Abby's New Stats:", JSON.stringify(abby, null, 2));
  }
}

runRebuild();
