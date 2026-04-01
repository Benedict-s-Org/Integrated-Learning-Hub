const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration from .env
const SUPABASE_URL = 'https://lpyhtbvycxqjjqpwjxyh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweWh0YnZ5Y3hxampxcHdqeHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2ODYyNDQsImV4cCI6MjA4MjI2MjI0NH0.cLmBHopkqJz3R8CtaVy3Cx6o9obOalczV5tAmVbofjg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OUTPUT_PATH = path.join(__dirname, '..', 'coin_history_export.xlsx');

async function exportCoinHistory() {
  console.log('Fetching users...');
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, display_name, class');
  
  if (userError) throw userError;

  const usersMap = {};
  users.forEach(u => {
    usersMap[u.id] = { name: u.display_name, class: u.class };
  });

  console.log('Fetching student records...');
  // Fetching all records. For very large datasets, pagination would be needed.
  const { data: records, error: recordError } = await supabase
    .from('student_records')
    .select('created_at, student_id, message, coin_amount, is_reverted')
    .order('created_at', { ascending: false });

  if (recordError) throw recordError;

  console.log(`Processing ${records.length} records...`);

  const formattedData = records.map(r => {
    const user = usersMap[r.student_id] || { name: 'Unknown', class: '-' };
    return {
      'Date/Time': new Date(r.created_at).toLocaleString(),
      'Student Name': user.name,
      'Class': user.class,
      'Activity': r.message,
      'Coins': r.coin_amount,
      'Status': r.is_reverted ? 'Reverted' : 'Active'
    };
  });

  console.log('Generating Excel workbook...');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(formattedData);

  // Set column widths
  const wscols = [
    { wch: 25 }, // Date
    { wch: 20 }, // Name
    { wch: 10 }, // Class
    { wch: 50 }, // Activity
    { wch: 10 }, // Coins
    { wch: 10 }  // Status
  ];
  ws['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, 'History');
  XLSX.writeFile(wb, OUTPUT_PATH);

  console.log(`Success! ${records.length} records exported to: ${OUTPUT_PATH}`);
}

exportCoinHistory().catch(console.error);
