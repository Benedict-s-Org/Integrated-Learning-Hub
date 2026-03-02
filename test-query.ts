import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function test() {
  console.log("Fetching...");
  const { data } = await supabase.from('class_rewards').select('title, type, coins, sub_options');
  console.log(JSON.stringify(data, null, 2));
}
test();
