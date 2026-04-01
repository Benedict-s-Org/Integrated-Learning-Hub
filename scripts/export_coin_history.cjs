const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Path to the SQL dump
const SQL_DUMP_PATH = path.join(__dirname, '..', 'public_data_dump.sql');
const OUTPUT_PATH = path.join(__dirname, '..', 'coin_history_export.xlsx');

async function exportCoinHistory() {
  console.log('Reading SQL dump...');
  const sql = fs.readFileSync(SQL_DUMP_PATH, 'utf8');

  // 1. Extract Users
  console.log('Parsing users...');
  const usersRecord = {};
  const userLines = sql.match(/INSERT INTO "public"\."users" .* VALUES\s*\(([\s\S]*?)\);/g) || 
                  sql.match(/INSERT INTO public\.users .* VALUES\s*\(([\s\S]*?)\);/g) || [];
  
  userLines.forEach(line => {
    // Extract rows from the multi-line VALUES statement
    const rows = line.match(/\(([^)]+)\)/g);
    if (rows) {
      rows.forEach(row => {
        const parts = row.slice(1, -1).split(',').map(p => p.trim().replace(/^'|'$/g, ''));
        // Based on schema: id is index 0, email is 1, display_name is 10, class is 12
        const id = parts[0];
        const display_name = parts[10] || parts[11] || parts[1]; // fallback to email
        const className = parts[12];
        usersRecord[id] = { name: display_name, class: className };
      });
    }
  });

  // 2. Extract Student Records
  console.log('Parsing student records...');
  const records = [];
  const recordLines = sql.match(/INSERT INTO "public"\."student_records" .* VALUES\s*\(([\s\S]*?)\);/g) ||
                    sql.match(/INSERT INTO public\.student_records .* VALUES\s*\(([\s\S]*?)\);/g) || [];

  recordLines.forEach(line => {
    const rows = line.match(/\(([^)]+)\)/g);
    if (rows) {
      rows.forEach(row => {
        const parts = row.slice(1, -1).split(',').map(p => p.trim().replace(/^'|'$/g, ''));
        // Schema for student_records:
        // Let's find the column list in the INSERT statement.
        const columnMatch = line.match(/INSERT INTO ("public")?\.?"?student_records"? \(([^)]+)\)/);
        if (columnMatch) {
          const columns = columnMatch[columnMatch.length - 1].split(',').map(c => c.trim().replace(/"/g, ''));
          const studentIdIdx = columns.indexOf('student_id');
          const messageIdx = columns.indexOf('message');
          const amountIdx = columns.indexOf('coin_amount');
          const dateIdx = columns.indexOf('created_at');
          const revertedIdx = columns.indexOf('is_reverted');

          const studentId = parts[studentIdIdx];
          const user = usersRecord[studentId] || { name: 'Unknown (' + studentId + ')', class: '-' };

          records.push({
            'Date/Time': parts[dateIdx],
            'Student Name': user.name,
            'Class': user.class,
            'Activity': parts[messageIdx],
            'Coins': parseInt(parts[amountIdx] || 0),
            'Status': parts[revertedIdx] === 'true' ? 'Reverted' : 'Active'
          });
        }
      });
    }
  });

  console.log(`Found ${records.length} records. Generating Excel...`);

  // Sort by date descending
  records.sort((a, b) => new Date(b['Date/Time']) - new Date(a['Date/Time']));

  // Create Workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(records);
  
  // Set column widths
  const wscols = [
    { wch: 25 }, // Date
    { wch: 15 }, // Name
    { wch: 10 }, // Class
    { wch: 50 }, // Activity
    { wch: 10 }, // Coins
    { wch: 10 }  // Status
  ];
  ws['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, 'Coin History');
  XLSX.writeFile(wb, OUTPUT_PATH);

  console.log('Success! File saved to:', OUTPUT_PATH);
}

exportCoinHistory().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
