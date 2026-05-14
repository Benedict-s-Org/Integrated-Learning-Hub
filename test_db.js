import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const config = fs.readFileSync('.env', 'utf8');
const urlMatch = config.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = config.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data, error } = await supabase.rpc('check_sched_policies');
  console.log("Policies:", JSON.stringify(data, null, 2));
}
run();
