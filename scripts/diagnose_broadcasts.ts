import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getHKTodayStartISO = () => {
    const now = new Date();
    const hkDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
    const [year, month, day] = hkDateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    date.setUTCHours(date.getUTCHours() - 8);
    return date.toISOString();
};

async function diagnose() {
  console.log('--- Diagnostic Start ---');
  console.log('Today HK Start:', getHKTodayStartISO());

  const { data: records, error } = await supabase
    .from('student_records')
    .select('id, type, message, created_at, student_id, student:student_id(display_name, class)')
    .gte('created_at', getHKTodayStartISO());

  if (error) {
    console.error('Error fetching records:', error);
    return;
  }

  console.log(`Found ${records?.length || 0} records for today.`);

  const stats = {
    total: records?.length || 0,
    withStudent: 0,
    withoutStudent: 0,
    classes: {} as Record<string, number>,
    messages: {} as Record<string, number>
  };

  records?.forEach((r: any) => {
    if (r.student) {
      stats.withStudent++;
      const cls = r.student.class || 'NULL';
      stats.classes[cls] = (stats.classes[cls] || 0) + 1;
    } else {
      stats.withoutStudent++;
    }
    stats.messages[r.message] = (stats.messages[r.message] || 0) + 1;
  });

  console.log('Stats:', JSON.stringify(stats, null, 2));

  console.log('\n--- Sample Records (First 5) ---');
  records?.slice(0, 5).forEach((r: any) => {
    console.log(`ID: ${r.id} | Msg: ${r.message} | Class: ${r.student?.class || 'N/A'} | Student: ${r.student?.display_name || 'N/A'}`);
  });

  console.log('\n--- Specific Broadcast Check ---');
  const broadcasts = records?.filter(r => r.message.includes(' ||{'));
  console.log(`Found ${broadcasts?.length || 0} messages with tagging suffix.`);
  broadcasts?.forEach(b => {
      console.log(`B: ${b.message} | Student Class: ${b.student?.class}`);
  });

  console.log('--- Diagnostic End ---');
}

diagnose();
