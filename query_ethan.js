import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envStr = fs.readFileSync('.env', 'utf8')
const env = {}
envStr.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) env[key] = rest.join('=').trim()
})

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function getEthan() {
  try {
    // 1. Find user Ethan
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('class', '3A')
      .eq('class_number', 2)
    
    if (userError) throw userError;
    if (!users || users.length === 0) {
      console.log("No student found with Class 3A and number 2.");
      return;
    }
    
    const ethan = users[0];
    console.log("Ethan User Record:", JSON.stringify(ethan, null, 2));

    // 2. Query user_room_data
    const { data: roomData, error: roomError } = await supabase
      .from('user_room_data')
      .select('*')
      .eq('user_id', ethan.id)
    
    if (roomError) throw roomError;
    console.log("\nEthan Room Data:", JSON.stringify(roomData, null, 2));

    // 3. Query student_records
    const { data: records, error: recError } = await supabase
      .from('student_records')
      .select('*')
      .eq('student_id', ethan.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (recError) throw recError;
    console.log("\nEthan Student Records (Recent 10):", JSON.stringify(records, null, 2));

    // 4. Query coin_transactions
    const { data: txs, error: txError } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', ethan.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (txError) throw txError;
    console.log("\nEthan Coin Transactions (Recent 10):", JSON.stringify(txs, null, 2));

  } catch (err) {
    console.error("Error querying database:", err);
  }
}

getEthan()
