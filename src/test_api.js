
const supabaseUrl = "https://lpyhtbvycxqjjqpwjxyh.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg";

async function test() {
  console.log("Testing reading-api...");
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/reading-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
        'x-action': 'list-page-questions'
      },
      body: JSON.stringify({ 
        sourcePageId: "3239baca-6fa3-800a-9612-fbf47d6f0738", // From previous test output
        pageNumber: 1,
        questionsDatabaseId: "3249baca6fa381f18526ca44ce27447c" 
      })
    });

    console.log("Status:", response.status);
    console.log("Status Text:", response.statusText);
    const data = await response.text();
    console.log("Response Body:", data);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

test();
