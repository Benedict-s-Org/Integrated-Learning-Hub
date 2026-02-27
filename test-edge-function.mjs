import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseKey) { 
  console.log("No key found, just using REST directly"); 
}

async function test() {
  // Try calling the function over HTTP using standard fetch
  const url = `${supabaseUrl}/functions/v1/auth/list-auth-emails`;
  
  console.log("Fetching: " + url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey}`
      },
      // Send a dummy ID first to see if the guard works, then we'll try to find a real one
      body: JSON.stringify({ adminUserId: 'b45fd653-33df-4c31-8077-854cb048bfda' }) // dummy valid UUID
    });
    
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
test();
