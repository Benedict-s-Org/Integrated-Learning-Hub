import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function fix() {
  console.log("Fixing 完成班務（欠功課）...");
  await supabase.from('class_rewards').update({ type: 'consequence', coins: -10 }).eq('title', '完成班務（欠功課）');
  
  console.log("Ensuring Answering questions has no sub_options acting weird...");
  await supabase.from('class_rewards').update({ sub_options: null }).eq('title', 'Answering questions');
  await supabase.from('class_rewards').update({ sub_options: null }).eq('title', '回答問題');
  console.log("Done.");
}
fix();
