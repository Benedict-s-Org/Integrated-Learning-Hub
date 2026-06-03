const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key === 'VITE_SUPABASE_URL') supabaseUrl = val;
      if (key === 'VITE_SUPABASE_ANON_KEY') supabaseKey = val;
    }
  }
} catch (e) {
  console.error("Error reading/parsing .env file:", e.message);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKey() {
  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .eq('key', 'notion_database_ids');
  if (error) {
    console.error('Error fetching key:', error);
  } else {
    console.log('Result for notion_database_ids:', data);
  }
}

checkKey();
