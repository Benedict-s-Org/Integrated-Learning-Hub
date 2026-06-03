const fs = require('fs');
const path = require('path');

const dumpPath = path.join(__dirname, 'public_data_dump.sql');

function parseDump() {
  let content = fs.readFileSync(dumpPath, 'utf8');
  const lines = content.split('\n');

  console.log("=== Emmy's User Record ===");
  const headers = [
    "id", "username", "password_hash", "role", "force_password_change", 
    "created_at", "updated_at", "accent_preference", "can_access_proofreading", 
    "can_access_spelling", "display_name", "email", "class", "qr_token", 
    "student_id", "marker_id", "managed_by_id", "can_access_learning_hub", 
    "class_number", "spelling_level", "seat_number", "ecas", 
    "can_access_spaced_repetition", "reading_rearranging_level", 
    "proofreading_level", "reading_proofreading_level", "memorization_level", 
    "voice_preference", "navigation_permissions"
  ];
  
  for (const line of lines) {
    if (line.includes('8cbc18ad-3c9b-4c93-a9fd-2b065578d319') && line.includes('s20231065@superleekam.edu.hk') && !line.includes('INSERT INTO')) {
      const cleanLine = line.trim().replace(/^\(/, '').replace(/\),?$/, '');
      // split by comma, respecting single quotes (approximate)
      const values = [];
      let currentVal = '';
      let inQuotes = false;
      for (let i = 0; i < cleanLine.length; i++) {
        const char = cleanLine[i];
        if (char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim());

      for (let j = 0; j < headers.length; j++) {
        console.log(`${headers[j]}: ${values[j]}`);
      }
    }
  }
}

parseDump();
