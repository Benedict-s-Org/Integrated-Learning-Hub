const fs = require('fs');
const https = require('https');

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) env[key] = rest.join('=').trim();
});

const options = {
  hostname: new URL(env.VITE_SUPABASE_URL).hostname,
  port: 443,
  path: '/rest/v1/system_config?select=value&key=eq.broadcast_v2_settings',
  method: 'GET',
  headers: {
    'apikey': env.VITE_SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + env.VITE_SUPABASE_ANON_KEY
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
req.on('error', e => console.error(e));
req.end();
