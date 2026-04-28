const fs = require('fs');

async function checkNotionSchema(dbId) {
  let token = null;
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const match = env.match(/NOTION_TOKEN=(.*)/);
    if (match) token = match[1].trim();
  } catch (e) {}

  if (!token) {
    try {
      const envLocal = fs.readFileSync('.env.local', 'utf8');
      const match = envLocal.match(/NOTION_TOKEN=(.*)/);
      if (match) token = match[1].trim();
    } catch (e) {}
  }

  if (!token) {
    console.error("Missing NOTION_TOKEN in .env or .env.local");
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

const dateDbId = "2579baca6fa3806f9c6ef193f7d81213";
checkNotionSchema(dateDbId);
