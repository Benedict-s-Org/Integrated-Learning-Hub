import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { 
  BookOpen, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  RefreshCw, 
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { getHKTodayString, formatHKDate } from '@/utils/dateUtils';

interface Student {
  id: string;
  display_name: string | null;
  class: string | null;
  class_number: number | null;
}

interface StudentRecord {
  id: string;
  student_id: string;
  message: string;
  created_at: string;
}

const SUBJECT_ORDER = ['中文', '英文', '數學', '常識', '其他'];

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  '中文': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', dot: 'bg-blue-500' },
  '英文': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', dot: 'bg-emerald-500' },
  '數學': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', dot: 'bg-amber-500' },
  '常識': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', dot: 'bg-purple-500' },
  '其他': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500' },
};

export default function AdminHomeworkSummaryPage() {
  const { isAdmin, isStaff } = useAuth();
  const isAuthorized = isAdmin || isStaff;
  const navigate = useNavigate();

  // Filter States
  const [selectedDate, setSelectedDate] = useState<string>(getHKTodayString());
  const [selectedClass, setSelectedClass] = useState<string>('3A');
  const [classes, setClasses] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'homework' | 'student'>('homework');
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Data States
  const [students, setStudents] = useState<Student[]>([]);
  const [dailyHomework, setDailyHomework] = useState<Record<string, string[]>>({});
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Time boundary utilities for local HK date queries
  const getHKDateStartISO = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    date.setUTCHours(date.getUTCHours() - 8); // HK timezone (UTC+8)
    return date.toISOString();
  };

  const getHKDateEndISO = (dateStr: string): string => {
    const start = new Date(getHKDateStartISO(dateStr));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return end.toISOString();
  };

  const parseMissingHomework = (message: string): Record<string, string[]> => {
    const result: Record<string, string[]> = {};
    if (!message.startsWith('功課:')) return result;
    
    const content = message.slice(3).trim();
    const regex = /([^(),]+)\s*\(([^()]+)\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const subject = match[1].trim();
      const itemsStr = match[2];
      const items = itemsStr.split(',').map(item => item.trim()).filter(Boolean);
      result[subject] = items;
    }
    return result;
  };

  // Initial Class List fetch
  useEffect(() => {
    if (!isAuthorized) {
      navigate('/');
      return;
    }

    const fetchClasses = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('class')
          .not('class', 'is', null);

        if (error) throw error;

        const uniqueClasses = Array.from(
          new Set(
            data
              .map((u: any) => u.class)
              .filter((c: string | null): c is string => !!c && c !== 'Unassigned')
          )
        ).sort();

        setClasses(uniqueClasses);
        if (uniqueClasses.includes('3A')) {
          setSelectedClass('3A');
        } else if (uniqueClasses.length > 0) {
          setSelectedClass(uniqueClasses[0]);
        }
      } catch (err) {
        console.error('Error fetching classes:', err);
      }
    };

    fetchClasses();
  }, [isAuthorized, navigate]);

  // Main Data Fetch
  const fetchData = async () => {
    if (!selectedClass) return;
    setIsLoading(true);
    try {
      const startISO = getHKDateStartISO(selectedDate);
      const endISO = getHKDateEndISO(selectedDate);

      // 1. Fetch Students
      const { data: studentsData, error: studentsError } = await supabase
        .from('users')
        .select('id, display_name, class, class_number')
        .eq('class', selectedClass)
        .eq('role', 'user')
        .order('class_number', { ascending: true });

      if (studentsError) throw studentsError;
      setStudents((studentsData || []) as Student[]);

      // 2. Fetch Homework Config
      const { data: configData, error: configError } = await supabase
        .from('daily_homework')
        .select('assignments')
        .eq('class_name', selectedClass)
        .eq('date', selectedDate)
        .maybeSingle();

      if (configError) throw configError;
      setDailyHomework((configData?.assignments as Record<string, string[]>) || {});

      // 3. Fetch Student Records for the day
      const { data: recordsData, error: recordsError } = await supabase
        .from('student_records')
        .select('id, student_id, message, created_at')
        .gte('created_at', startISO)
        .lt('created_at', endISO)
        .or(`message.like.完成班務（交齊功課）%,message.like.完成班務（欠功課）%,message.like.功課:%`);

      if (recordsError) throw recordsError;
      setRecords((recordsData || []) as StudentRecord[]);

    } catch (err) {
      console.error('Error loading homework summary:', err);
      alert('Failed to load homework data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized && selectedClass) {
      fetchData();
    }
  }, [isAuthorized, selectedDate, selectedClass]);

  // Process mapping of Student -> latest record
  const latestStudentRecords = useMemo(() => {
    const map: Record<string, StudentRecord> = {};
    const sorted = [...records].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    sorted.forEach(rec => {
      if (!map[rec.student_id]) {
        map[rec.student_id] = rec;
      }
    });
    return map;
  }, [records]);

  // Process Homework Items List
  const homeworkItemsList = useMemo(() => {
    const list: { subject: string; item: string }[] = [];
    const subjects = Object.keys(dailyHomework).sort((a, b) => {
      const idxA = SUBJECT_ORDER.indexOf(a);
      const idxB = SUBJECT_ORDER.indexOf(b);
      const valA = idxA === -1 ? 999 : idxA;
      const valB = idxB === -1 ? 999 : idxB;
      return valA - valB;
    });

    subjects.forEach(subject => {
      const items = dailyHomework[subject] || [];
      items.forEach(item => {
        list.push({ subject, item });
      });
    });

    return list;
  }, [dailyHomework]);

  // Map each homework item to students who missed it
  const missingStudentsMap = useMemo(() => {
    const map: Record<string, Student[]> = {};
    
    homeworkItemsList.forEach(({ subject, item }) => {
      const key = `${subject}:${item}`;
      const missingList: Student[] = [];

      students.forEach(student => {
        const record = latestStudentRecords[student.id];
        if (!record) return;

        const isGeneralMissing = record.message === '完成班務（欠功課）';
        const parsed = parseMissingHomework(record.message);
        const isSpecificMissing = parsed[subject]?.includes(item) || false;

        if (isGeneralMissing || isSpecificMissing) {
          missingList.push(student);
        }
      });

      map[key] = missingList;
    });

    return map;
  }, [homeworkItemsList, students, latestStudentRecords]);

  // Student statuses memo
  const studentStatuses = useMemo(() => {
    return students.map(student => {
      const record = latestStudentRecords[student.id];
      let status: 'completed' | 'missing' | 'none' = 'none';
      let details = '';
      let timeStr = '';

      if (record) {
        timeStr = new Date(record.created_at).toLocaleTimeString('zh-HK', {
          timeZone: 'Asia/Hong_Kong',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        if (record.message === '完成班務（交齊功課）') {
          status = 'completed';
        } else if (record.message === '完成班務（欠功課）') {
          status = 'missing';
          details = '未指明 (General)';
        } else if (record.message.startsWith('功課:')) {
          status = 'missing';
          details = record.message.slice(3).trim();
        }
      }

      return {
        ...student,
        status,
        details,
        timeStr
      };
    });
  }, [students, latestStudentRecords]);

  // Filter students based on search string
  const filteredStudentStatuses = useMemo(() => {
    return studentStatuses.filter(s => {
      if (!studentSearch) return true;
      const term = studentSearch.toLowerCase();
      return (
        s.display_name?.toLowerCase().includes(term) ||
        s.class_number?.toString().includes(term) ||
        s.details?.toLowerCase().includes(term)
      );
    });
  }, [studentStatuses, studentSearch]);

  if (!isAuthorized) return null;

  return (
    <AdminLayout 
      title="Homework Summary (功課提交總結)" 
      icon={<ClipboardList className="w-8 h-8" />}
    >
      <div className="min-h-[calc(100vh-6rem)] bg-slate-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Filters Bar */}
          <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
              
              {/* Date Filter */}
              <div className="flex flex-col gap-1.5 min-w-[150px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Calendar size={12} />
                  選擇日期 (Date)
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Class Filter */}
              <div className="flex flex-col gap-1.5 min-w-[120px]">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Users size={12} />
                  班別 (Class)
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors cursor-pointer"
                >
                  {classes.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                  {classes.length === 0 && (
                    <option value="3A">3A</option>
                  )}
                </select>
              </div>

              {/* Search input (only for Student tab) */}
              {activeTab === 'student' && (
                <div className="flex flex-col gap-1.5 min-w-[200px] flex-1 md:flex-none">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Search size={12} />
                    搜尋學生/詳情 (Search)
                  </label>
                  <input
                    type="text"
                    placeholder="Search name, status..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              )}

            </div>

            <button
              onClick={fetchData}
              disabled={isLoading}
              className="w-full md:w-auto px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow active:scale-95 transition-all text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span>重新整理 (Refresh)</span>
            </button>
          </div>

          {/* Toggle Tab */}
          <div className="flex border-b border-slate-200 bg-slate-100/50 p-1.5 rounded-2xl max-w-md">
            <button
              onClick={() => setActiveTab('homework')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${
                activeTab === 'homework'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <BookOpen size={16} />
              按功課項目查看 (Homework View)
            </button>
            <button
              onClick={() => setActiveTab('student')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${
                activeTab === 'student'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <Users size={16} />
              按學生狀態查看 (Student View)
            </button>
          </div>

          {/* Main Content Area */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-slate-400 font-bold text-sm">載入數據中 (Loading summary)...</p>
            </div>
          ) : activeTab === 'homework' ? (
            /* Tab 1: Homework View */
            <div className="space-y-6">
              {homeworkItemsList.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-sm">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-black text-slate-700 mb-2">今天暫無功課設定</h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                    {formatHKDate(getHKDateStartISO(selectedDate))} {selectedClass} 班今天尚未有配置的提交功課清單。
                  </p>
                  <button
                    onClick={() => navigate('/')}
                    className="px-5 py-3 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 hover:shadow-lg transition-all active:scale-95 text-xs tracking-wider flex items-center gap-2 mx-auto"
                  >
                    前往班務儀表板設定 (Go to Class Dashboard)
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {homeworkItemsList.map(({ subject, item }) => {
                    const key = `${subject}:${item}`;
                    const missingList = missingStudentsMap[key] || [];
                    const hasMissing = missingList.length > 0;
                    const style = SUBJECT_COLORS[subject] || SUBJECT_COLORS['其他'];

                    return (
                      <div
                        key={key}
                        className={`bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[180px] transition-all hover:shadow-md hover:scale-[1.01]`}
                      >
                        {/* Card Header */}
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                              {subject}
                            </span>
                            <span className="font-black text-sm text-slate-800 tracking-tight">{item}</span>
                          </div>
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                            hasMissing ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-green-50 text-green-600 border border-green-100'
                          }`}>
                            {hasMissing ? `欠 ${missingList.length} 人` : '全交齊'}
                          </span>
                        </div>

                        {/* Card Content: Missing Students */}
                        <div className="p-5 flex-1 flex flex-col justify-center">
                          {hasMissing ? (
                            <div className="flex flex-wrap gap-2">
                              {missingList.map(student => (
                                <div
                                  key={student.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-100 bg-rose-50/30 text-rose-700 text-xs font-bold"
                                >
                                  <span className="w-5 h-5 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center text-[9px] font-black">
                                    {student.class_number}
                                  </span>
                                  <span>{student.display_name}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center space-y-2 py-4">
                              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500 shadow-sm border border-green-100">
                                <CheckCircle2 size={20} />
                              </div>
                              <span className="text-xs text-green-600 font-black">全班同學已提交 (All Done)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Student View */
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">座號 (Seat)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">姓名 (Name)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">狀態 (Status)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">詳情 (Missed Homework)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">時間 (Time)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudentStatuses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm font-medium">
                          沒有找到相符的學生記錄 (No students found matching filters)
                        </td>
                      </tr>
                    ) : (
                      filteredStudentStatuses.map(student => (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                          
                          {/* Seat */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100 text-slate-600 text-xs font-black">
                              {student.class_number}
                            </span>
                          </td>

                          {/* Name */}
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800 text-sm">
                            {student.display_name}
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {student.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-green-700 bg-green-50 border border-green-200 shadow-sm">
                                <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                                交齊功課 (All Done)
                              </span>
                            ) : student.status === 'missing' ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 shadow-sm animate-pulse">
                                <XCircle size={12} className="text-rose-500 shrink-0" />
                                欠功課 (Missing)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200">
                                未有記錄 (No Record)
                              </span>
                            )}
                          </td>

                          {/* Details */}
                          <td className="px-6 py-4 text-sm text-slate-600 font-semibold max-w-md truncate">
                            {student.status === 'missing' ? (
                              <span className="text-rose-600 bg-rose-50/20 px-2.5 py-1 rounded-lg border border-rose-100/50">
                                {student.details}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Time */}
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-bold">
                            {student.timeStr || '-'}
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </AdminLayout>
  );
}
