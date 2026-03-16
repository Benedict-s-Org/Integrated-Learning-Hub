import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  GraduationCap,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Check,
  ChevronRight,
  User as UserIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface StudentLevelInfo {
  id: string;
  display_name: string;
  username: string;
  class: string | null;
  class_number: number | null;
  spelling_level: number;
  reading_rearranging_level: number;
  reading_proofreading_level: number;
  proofreading_level: number;
  memorization_level: number;
}

const LEVEL_CONFIG = [
  { key: 'spelling_level', label: 'Spelling', max: 2, color: 'indigo' },
  { key: 'reading_rearranging_level', label: 'Rearrange', max: 2, color: 'purple' },
  { key: 'reading_proofreading_level', label: 'Read-Proof', max: 3, color: 'pink' },
  { key: 'memorization_level', label: 'Memorize', max: 3, color: 'emerald' },
  { key: 'proofreading_level', label: 'Proofread', max: 2, color: 'amber' },
] as const;

export const AdminStudentLevelsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [students, setStudents] = useState<StudentLevelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<StudentLevelInfo>>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('user-management/list-users', {
        body: { adminUserId: currentUser?.id }
      });

      if (error) throw error;
      
      const studentsOnly = (data.users || []).filter((u: any) => u.role === 'user');
      setStudents(studentsOnly.map((u: any) => ({
        id: u.id,
        display_name: u.display_name || 'Unnamed',
        username: u.username,
        class: u.class,
        class_number: u.class_number,
        spelling_level: u.spelling_level || 1,
        reading_rearranging_level: u.reading_rearranging_level || 1,
        reading_proofreading_level: u.reading_proofreading_level || 1,
        proofreading_level: u.proofreading_level || 1,
        memorization_level: u.memorization_level || 1
      })));
      setPendingChanges({});
    } catch (err: any) {
      console.error('Error fetching students:', err);
      setMessage({ type: 'error', text: 'Failed to load students' });
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesClass = filterClass === 'all' || s.class === filterClass;
      const matchesSearch = s.display_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           s.username.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesClass && matchesSearch;
    }).sort((a, b) => {
      if (a.class !== b.class) return (a.class || '').localeCompare(b.class || '');
      return (a.class_number || 0) - (b.class_number || 0);
    });
  }, [students, filterClass, searchQuery]);

  const classes = useMemo(() => {
    const classSet = new Set(students.map(s => s.class).filter(Boolean));
    return Array.from(classSet).sort() as string[];
  }, [students]);

  const handleLevelChange = (studentId: string, key: string, level: number) => {
    setPendingChanges(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [key]: level
      }
    }));
  };

  const saveAllChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) return;
    setIsSaving(true);
    setLoading(true);
    try {
      const updates = Object.entries(pendingChanges).map(([id, changes]) => {
        const camelChanges = Object.entries(changes).reduce((acc, [key, val]) => {
          const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
          return { ...acc, [camelKey]: val };
        }, {});
        return { id, ...camelChanges };
      });

      const { error } = await supabase.functions.invoke('user-management/bulk-update-users', {
        body: { adminUserId: currentUser?.id, updates }
      });

      if (error) throw error;

      // Update local state
      setStudents(prev => prev.map(s => {
        if (pendingChanges[s.id]) {
          return { ...s, ...pendingChanges[s.id] };
        }
        return s;
      }));
      
      setPendingChanges({});
      setMessage({ type: 'success', text: 'Successfully saved all level changes' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Error saving changes:', err);
      setMessage({ type: 'error', text: `Failed to save changes: ${err.message || 'Unknown error'}` });
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };

  const handleBulkUpdate = (key: string, level: number) => {
    if (selectedIds.length === 0) return;
    const newPending = { ...pendingChanges };
    selectedIds.forEach(id => {
      newPending[id] = {
        ...(newPending[id] || {}),
        [key]: level
      };
    });
    setPendingChanges(newPending);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const LevelGrid = ({ value, pendingValue, max, onChange, color, isUpdating }: { value: number, pendingValue?: number, max: number, onChange: (val: number) => void, color: string, isUpdating: boolean }) => {
    const displayValue = pendingValue !== undefined ? pendingValue : value;
    const isPending = pendingValue !== undefined;

    return (
      <div className="flex gap-1.5 justify-center items-center">
        {Array.from({ length: max }).map((_, i) => {
          const lv = i + 1;
          const isActive = displayValue === lv;
          return (
            <button
              key={lv}
              onClick={() => onChange(lv)}
              disabled={isUpdating}
              className={`
                w-8 h-8 rounded-lg font-black text-xs transition-all duration-300 flex items-center justify-center relative
                ${isActive 
                  ? `bg-${color}-600 text-white shadow-lg shadow-${color}-200 scale-110 z-10` 
                  : 'bg-white text-slate-500 border border-slate-300 hover:border-indigo-400 hover:text-indigo-600 hover:scale-105'}
                ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                ${isActive && isPending ? 'ring-2 ring-offset-2 ring-indigo-400' : ''}
              `}
              title={`Set to Level ${lv}`}
            >
              {isActive && isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                lv
              )}
              {isActive && isPending && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white shadow-sm" />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  return (
    <AdminLayout title="Student Practice Levels" icon={<GraduationCap className="w-6 h-6" />}>
      <div className="p-6 md:p-10 max-w-full mx-auto space-y-8 pb-32">
        {/* Header Actions */}
        <div className="flex flex-col xl:flex-row gap-6 items-center justify-between bg-white/40 backdrop-blur-xl p-6 rounded-[2.5rem] border-4 border-white shadow-xl shadow-slate-200/50">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative group">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="pl-11 pr-8 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer shadow-sm"
              >
                <option value="all">All Classes</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {hasPendingChanges && (
              <button
                onClick={saveAllChanges}
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 animate-bounce-subtle"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save all changes ({Object.keys(pendingChanges).length})
              </button>
            )}
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">
                {filteredStudents.length} Students
              </span>
            </div>
            <button 
              onClick={fetchStudents}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Sync Data
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`flex items-center gap-3 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-bold">{message.text}</span>
          </div>
        )}

        {/* Student Table */}
        <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border-4 border-white shadow-2xl shadow-slate-200/50 overflow-hidden ring-1 ring-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-100/50 bg-slate-50/50">
                  <th className="p-6 w-20 text-center">
                    <button 
                      onClick={() => setSelectedIds(selectedIds.length === filteredStudents.length ? [] : filteredStudents.map(s => s.id))}
                      className={`p-2 rounded-xl transition-all ${selectedIds.length > 0 ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-300 text-slate-400'}`}
                    >
                      {selectedIds.length === filteredStudents.length ? <Check className="w-5 h-5" /> : <div className="w-5 h-5" />}
                    </button>
                  </th>
                  <th className="p-6 text-sm font-black text-slate-400 uppercase tracking-widest">Student</th>
                  {LEVEL_CONFIG.map(config => (
                    <th key={config.key} className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap bg-slate-50/30">
                      {config.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !isSaving ? (
                  <tr>
                    <td colSpan={7} className="py-40">
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
                          <div className="absolute inset-0 flex items-center justify-center">
                             <GraduationCap className="w-5 h-5 text-indigo-300" />
                          </div>
                        </div>
                        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Synchronizing Records...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-40 text-center">
                      <p className="text-slate-400 font-bold">No students found matching your filters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr 
                      key={student.id} 
                      className={`group border-b border-slate-100/50 transition-all duration-300 ${selectedIds.includes(student.id) ? 'bg-indigo-50/40 translate-x-1' : 'hover:bg-white/60'}`}
                    >
                      <td className="p-6 text-center">
                        <button 
                          onClick={() => toggleSelect(student.id)} 
                          className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center border-2 ${selectedIds.includes(student.id) ? 'bg-indigo-600 border-indigo-600 text-white scale-110 shadow-lg' : 'bg-white border-slate-300 text-slate-300 hover:border-slate-400 active:scale-95 group-hover:text-slate-400'}`}
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      </td>
                      <td className="p-6 min-w-[250px]">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 flex items-center justify-center text-indigo-600 font-black shadow-sm group-hover:scale-110 transition-transform">
                            <UserIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-800 text-lg leading-tight">{student.display_name}</span>
                              <div className="px-2.5 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                                {student.class || 'No Class'} {student.class_number && `#${student.class_number}`}
                              </div>
                            </div>
                            <span className="text-xs text-slate-400 font-bold">{student.username}</span>
                          </div>
                        </div>
                      </td>
                      {LEVEL_CONFIG.map(config => (
                        <td key={config.key} className="p-6 transition-all bg-slate-50/10 hover:bg-slate-50/30">
                          <LevelGrid 
                            value={(student as any)[config.key]} 
                            pendingValue={pendingChanges[student.id]?.[config.key as keyof StudentLevelInfo] as number}
                            max={config.max} 
                            color={config.color}
                            isUpdating={isSaving && pendingChanges[student.id]?.[config.key as keyof StudentLevelInfo] !== undefined}
                            onChange={(val) => handleLevelChange(student.id, config.key, val)} 
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-700">
            <div className="bg-slate-900/95 backdrop-blur-3xl px-8 py-6 rounded-[3rem] border border-white/20 shadow-2xl shadow-indigo-500/20 flex flex-wrap items-center gap-10">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-500/40">
                  {selectedIds.length}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Selected</span>
                  <span className="text-white font-black text-lg">Students</span>
                </div>
              </div>
              <div className="h-12 w-[1px] bg-white/20" />

              <div className="flex flex-wrap items-center gap-6">
                {LEVEL_CONFIG.map(config => (
                   <div key={config.key} className="flex flex-col gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{config.label}</span>
                      <div className="flex gap-1.5">
                        {Array.from({ length: config.max }).map((_, i) => (
                          <button
                            key={i + 1}
                            onClick={() => handleBulkUpdate(config.key, i + 1)}
                            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-indigo-600 text-white font-black text-sm transition-all hover:scale-110 active:scale-95 border border-white/5"
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                   </div>
                ))}
              </div>

              <div className="h-12 w-[1px] bg-white/20" />

              <button 
                onClick={() => setSelectedIds([])}
                className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <span className="text-xs font-black uppercase tracking-widest">Clear</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminStudentLevelsPage;
