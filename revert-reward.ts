import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function revert() {
  console.log("Reverting 完成班務（欠功課） to reward with 10 coins...");
  const { error } = await supabase.from('class_rewards')
    .update({ type: 'reward', coins: 10 })
    .eq('title', '完成班務（欠功課）');
  
  if (error) console.error("Error reverting:", error);
  else console.log("Successfully reverted.");
}
revert();
