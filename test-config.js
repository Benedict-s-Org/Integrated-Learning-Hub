import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function get() {
  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .eq('key', 'broadcast_v2_settings')
  console.log('Error:', error)
  console.log('Data:', JSON.stringify(data, null, 2))
}
get()
