import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

export interface ClassArchiveStudent {
  id: string;
  class_number: number | null;
  display_name: string;
  username: string;
  coins: number;
  virtual_coins: number;
  house_level: number;
  spelling_level?: number | null;
  reading_rearranging_level?: number | null;
  reading_proofreading_level?: number | null;
  memorization_level?: number | null;
  proofreading_level?: number | null;
}

export interface ClassArchiveRecord {
  id: string;
  student_id: string;
  student_class_number: number | null;
  student_name: string;
  student_username: string;
  created_at: string;
  type: 'positive' | 'negative' | 'neutral' | string;
  coin_amount: number;
  message: string;
  is_virtual: boolean;
}

export interface ClassArchivePayload {
  className: string;
  academicYearLabel: string;
  exportedAt: string;
  exportedBy?: string;
  students: ClassArchiveStudent[];
  records: ClassArchiveRecord[];
}

export interface AcademicYearOption {
  key: string;
  label: string;
  yearTag: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Generates sensible academic year options based on current date in Hong Kong (starts Sep 1).
 */
export function getAcademicYearOptions(): AcademicYearOption[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  let primaryYearStart = currentYear;
  if (currentMonth < 9) {
    primaryYearStart = currentYear - 1;
  }

  const curLabel = `${primaryYearStart}-${primaryYearStart + 1}`;
  const prevLabel = `${primaryYearStart - 1}-${primaryYearStart}`;

  return [
    {
      key: 'current',
      label: `本學年 (${curLabel} 學年: ${primaryYearStart}-09-01 至今)`,
      yearTag: curLabel,
      startDate: `${primaryYearStart}-09-01T00:00:00+08:00`,
      endDate: undefined
    },
    {
      key: 'previous',
      label: `上一學年 (${prevLabel} 學年: ${primaryYearStart - 1}-09-01 至 ${primaryYearStart}-08-31)`,
      yearTag: prevLabel,
      startDate: `${primaryYearStart - 1}-09-01T00:00:00+08:00`,
      endDate: `${primaryYearStart}-08-31T23:59:59+08:00`
    },
    {
      key: 'all',
      label: '全部歷史紀錄 (不限日期區間)',
      yearTag: '歷年存檔',
      startDate: undefined,
      endDate: undefined
    }
  ];
}

/**
 * Fetch all students and their student_records for a class with batching to avoid URL length limits.
 */
export async function fetchClassArchiveData(
  className: string,
  yearOption?: AcademicYearOption,
  operatorName?: string
): Promise<ClassArchivePayload> {
  // 1. Fetch all students in this class
  const { data: usersData, error: usersError } = await (supabase
    .from('users')
    .select('*')
    .eq('class', className)
    .order('seat_number', { ascending: true }) as any);

  if (usersError) {
    console.error('[ArchiveExporter] Error fetching class students:', usersError);
    throw usersError;
  }

  const studentList: any[] = usersData || [];
  const studentIds: string[] = studentList.map(u => u.id);

  if (studentIds.length === 0) {
    return {
      className,
      academicYearLabel: yearOption?.label || '全部紀錄',
      exportedAt: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' }),
      exportedBy: operatorName || 'Admin',
      students: [],
      records: []
    };
  }

  // 2. Fetch room data for coins (Chunked into batches of 30 items)
  const BATCH_SIZE = 30;
  const roomDataMap = new Map<string, any>();
  const idChunks: string[][] = [];
  for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
    idChunks.push(studentIds.slice(i, i + BATCH_SIZE));
  }

  await Promise.all(
    idChunks.map(async chunk => {
      const { data, error } = await supabase
        .from('user_room_data')
        .select('user_id, coins, virtual_coins, house_level')
        .in('user_id', chunk);
      if (!error && data) {
        data.forEach(r => roomDataMap.set(r.user_id, r));
      }
    })
  );

  // 3. Map students
  const students: ClassArchiveStudent[] = studentList.map(u => {
    const rd = roomDataMap.get(u.id);
    return {
      id: u.id,
      class_number: u.class_number ?? u.seat_number ?? null,
      display_name: u.display_name || u.username || '未命名',
      username: u.username || '',
      coins: rd?.coins || 0,
      virtual_coins: rd?.virtual_coins || 0,
      house_level: rd?.house_level || 1,
      spelling_level: u.spelling_level ?? null,
      reading_rearranging_level: u.reading_rearranging_level ?? null,
      reading_proofreading_level: u.reading_proofreading_level ?? null,
      memorization_level: u.memorization_level ?? null,
      proofreading_level: u.proofreading_level ?? null
    };
  });

  // Sort students by class number
  students.sort((a, b) => {
    if (a.class_number != null && b.class_number != null) {
      return a.class_number - b.class_number;
    }
    return a.display_name.localeCompare(b.display_name);
  });

  const studentLookup = new Map<string, ClassArchiveStudent>(students.map(s => [s.id, s]));

  // 4. Fetch student_records for all students in batches
  const allRecords: ClassArchiveRecord[] = [];

  await Promise.all(
    idChunks.map(async chunk => {
      let query = (supabase as any)
        .from('student_records')
        .select('*')
        .in('student_id', chunk)
        .order('created_at', { ascending: true });

      if (yearOption?.startDate) {
        query = query.gte('created_at', yearOption.startDate);
      }
      if (yearOption?.endDate) {
        query = query.lte('created_at', yearOption.endDate);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[ArchiveExporter] Error fetching student records chunk:', error);
        return;
      }

      if (data && Array.isArray(data)) {
        data.forEach(r => {
          const st = studentLookup.get(r.student_id);
          allRecords.push({
            id: r.id,
            student_id: r.student_id,
            student_class_number: st?.class_number ?? null,
            student_name: st?.display_name || '未知學生',
            student_username: st?.username || '',
            created_at: r.created_at,
            type: r.type || 'neutral',
            coin_amount: r.coin_amount || 0,
            message: r.message || '',
            is_virtual: !!r.is_virtual
          });
        });
      }
    })
  );

  // Sort records chronologically (and by student seat number)
  allRecords.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (a.student_class_number ?? 0) - (b.student_class_number ?? 0);
  });

  return {
    className,
    academicYearLabel: yearOption?.label || '全部紀錄',
    exportedAt: new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' }),
    exportedBy: operatorName || 'Admin',
    students,
    records: allRecords
  };
}

/**
 * Format type string into user-friendly Chinese label
 */
function formatRecordType(type: string): string {
  switch (type) {
    case 'positive':
      return '正面獎勵';
    case 'negative':
      return '負面扣分';
    case 'neutral':
      return '一般紀錄';
    default:
      return type || '一般';
  }
}

/**
 * Export Class Archive data to Excel (.xlsx) with 2 structured sheets.
 */
export function exportClassArchiveToExcel(data: ClassArchivePayload): string {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 學生結餘總覽 (Summary)
  const summaryRows = data.students.map(s => ({
    '班別': data.className,
    '座號': s.class_number != null ? String(s.class_number).padStart(2, '0') : '--',
    '學生姓名': s.display_name,
    '登入帳號': s.username,
    '封存前金幣': s.coins,
    '虛擬金幣': s.virtual_coins,
    '房屋等級': `Lv.${s.house_level}`,
    '默寫等級': s.spelling_level != null ? `Lv.${s.spelling_level}` : '--',
    '校對等級': s.proofreading_level != null ? `Lv.${s.proofreading_level}` : '--',
    '重組等級': s.reading_rearranging_level != null ? `Lv.${s.reading_rearranging_level}` : '--',
    '記憶等級': s.memorization_level != null ? `Lv.${s.memorization_level}` : '--',
    '學生系統ID': s.id
  }));

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 8 },  // 班別
    { wch: 6 },  // 座號
    { wch: 18 }, // 姓名
    { wch: 16 }, // 帳號
    { wch: 12 }, // 金幣
    { wch: 10 }, // 虛擬金幣
    { wch: 10 }, // 房屋等級
    { wch: 10 }, // 默寫等級
    { wch: 10 }, // 校對等級
    { wch: 10 }, // 重組等級
    { wch: 10 }, // 記憶等級
    { wch: 38 }  // 學生系統ID
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, '學生名冊與結餘');

  // Sheet 2: 學年獎懲與歷程明細 (Records)
  const recordRows = data.records.map(r => ({
    '紀錄時間': r.created_at ? new Date(r.created_at).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' }) : '--',
    '班別': data.className,
    '座號': r.student_class_number != null ? String(r.student_class_number).padStart(2, '0') : '--',
    '學生姓名': r.student_name,
    '登入帳號': r.student_username,
    '類別': formatRecordType(r.type),
    '金幣變動': r.coin_amount > 0 ? `+${r.coin_amount}` : String(r.coin_amount),
    '事由說明 / 項目': r.message,
    '虛擬金幣': r.is_virtual ? '是' : '否',
    '學生系統ID': r.student_id,
    '紀錄ID': r.id
  }));

  const wsRecords = XLSX.utils.json_to_sheet(recordRows);
  wsRecords['!cols'] = [
    { wch: 22 }, // 紀錄時間
    { wch: 8 },  // 班別
    { wch: 6 },  // 座號
    { wch: 16 }, // 姓名
    { wch: 14 }, // 帳號
    { wch: 12 }, // 類別
    { wch: 10 }, // 金幣變動
    { wch: 35 }, // 事由說明
    { wch: 10 }, // 虛擬金幣
    { wch: 38 }, // 學生系統ID
    { wch: 38 }  // 紀錄ID
  ];
  XLSX.utils.book_append_sheet(wb, wsRecords, '學年獎懲與歷程明細');

  // Generate filename: e.g. 3A_學年學生紀錄封存備份_20260922_2330.xlsx
  const dateStamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
  const cleanClassName = data.className.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanClassName}_學年學生紀錄封存備份_${dateStamp}.xlsx`;

  XLSX.writeFile(wb, filename);
  return filename;
}

/**
 * Export Class Archive data to JSON (.json) format for 100% precise technical restoration.
 */
export function exportClassArchiveToJSON(data: ClassArchivePayload): string {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const dateStamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
  const cleanClassName = data.className.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanClassName}_學年封存備份_${dateStamp}.json`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  return filename;
}
