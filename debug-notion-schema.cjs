
const fs = require('fs');

async function checkNotionSchema(dbId) {
  // Try to find NOTION_TOKEN from .env or .env.local
  let token = null;
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const match = env.match(/NOTION_TOKEN=(.*)/);
    if (match) token = match[1].trim();
  } catch (e) {}

  if (!token) {
    console.error("Missing NOTION_TOKEN in .env");
    return;
  }

  console.log(`Checking schema for DB: ${dbId}`);
  const resp = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    }
  });

  const data = await resp.json();
  if (data.properties) {
    console.log("Properties found:");
    Object.keys(data.properties).forEach(p => {
      console.log(`- ${p} (${data.properties[p].type})`);
    });
  } else {
    console.error("No properties found. Error:", data);
  }
}

// Check both potential databases
const pdfsDbId = "3239baca6fa380a9b501deceb133946d";
const questionsDbId = "3249baca6fa381f18526ca44ce27447c";

(async () => {
  await checkNotionSchema(pdfsDbId);
  console.log("\n---\n");
  await checkNotionSchema(questionsDbId);
})();
