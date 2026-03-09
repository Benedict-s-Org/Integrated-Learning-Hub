import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envStr = fs.readFileSync('.env.local', 'utf8')
const env = {}
envStr.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) env[key] = rest.join('=').trim()
})

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

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
