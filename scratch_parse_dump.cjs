const fs = require('fs');
const path = require('path');

const dumpPath = path.join(__dirname, 'public_data_dump.sql');

function parseDump() {
  console.log("Reading dump file:", dumpPath);
  let content;
  try {
    content = fs.readFileSync(dumpPath, 'utf8');
  } catch (e) {
    console.error("Failed to read public_data_dump.sql, trying dump.sql...");
    try {
      content = fs.readFileSync(path.join(__dirname, 'dump.sql'), 'utf8');
    } catch (err) {
      console.error("Could not read any dump file:", err.message);
      return;
    }
  }

  const lines = content.split('\n');
  
  // Find Emmy's user record
  let emmyRow = null;
  for (const line of lines) {
    if (line.includes('8cbc18ad-3c9b-4c93-a9fd-2b065578d319')) {
      console.log("Found Emmy row in SQL:");
      console.log(line.trim());
      emmyRow = line.trim();
    }
  }

  // Find spelling practices
  console.log("\n--- Spelling Practices ---");
  for (const line of lines) {
    if (line.includes('24de5378-c5d4-4345-8fe7-f92c8ffb06c8') && line.includes('spelling_practices')) {
      console.log(line.trim());
    }
    if (line.includes('14bffd30-39a9-41da-868a-2ec540995c86') && line.includes('spelling_practices')) {
      console.log(line.trim());
    }
    // Also print rows starting with the IDs in INSERT INTO statements
    if (line.includes('24de5378-c5d4-4345-8fe7-f92c8ffb06c8') && !line.includes('INSERT INTO')) {
      console.log("Data row containing practice 24de5378:", line.trim());
    }
    if (line.includes('14bffd30-39a9-41da-868a-2ec540995c86') && !line.includes('INSERT INTO')) {
      console.log("Data row containing practice 14bffd30:", line.trim());
    }
  }

  // Find practice assignments
  console.log("\n--- Practice Assignments for Emmy ---");
  for (const line of lines) {
    if (line.includes('8cbc18ad-3c9b-4c93-a9fd-2b065578d319') && line.includes('practice_assignments')) {
      console.log("Assignment definition line:", line.trim());
    }
    if (line.includes('8cbc18ad-3c9b-4c93-a9fd-2b065578d319') && !line.includes('INSERT INTO') && !line.includes('users')) {
      console.log("Assignment row:", line.trim());
    }
  }
}

parseDump();
