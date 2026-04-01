import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { 
    Plus, 
    Check, 
    Search, 
    Save, 
    Calendar,
    Settings2,
    CheckSquare,
    Square,
    Loader2,
    LayoutGrid,
    Trash2,
    Pencil
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { playSuccessSound } from '@/utils/audio';

interface Student {
    id: string;
    display_name: string | null;
    class: string | null;
    class_number: number | null;
}

interface HabitOption {
    id: string;
    label: string;
    category: string | null;
}

export default function AdminHomeworkHabitPage() {
    const { user } = useAuth();
    
    // Core Data State
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [habitOptions, setHabitOptions] = useState<HabitOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form Selection State
    const [selectedClass, setSelectedClass] = useState<string>('3A');
    const [homeworkTitle, setHomeworkTitle] = useState('');
    const [assignedDate, setAssignedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [studentSearch, setStudentSearch] = useState('');

    // Matrix State: studentId -> habitId -> boolean
    const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
    const [newHabitLabel, setNewHabitLabel] = useState('');
    const [isAddingHabit, setIsAddingHabit] = useState(false);
    
    // Edit/Delete Mode State
    const [isEditMode, setIsEditMode] = useState(false);
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
    const [editingLabelValue, setEditingLabelValue] = useState('');

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            // Fetch Students
            const { data: userData, error: userError } = await (supabase
                .from('users')
                .select('id, display_name, class, class_number') as any)
                .order('class', { ascending: true })
                .order('class_number', { ascending: true });

            if (userError) throw userError;
            const studentsData = (userData || []) as Student[];
            setStudents(studentsData);

            const uniqueClasses: string[] = Array.from(new Set(studentsData
                .map((u: Student) => u.class)
                .filter((c: string | null): c is string => !!c)))
                .sort();
            setClasses(uniqueClasses);

            if (uniqueClasses.includes('3A')) {
                setSelectedClass('3A');
            } else if (uniqueClasses.length > 0) {
                setSelectedClass(uniqueClasses[0]);
            }

            // Fetch Habit Options from homework_problem_options
            const { data: habitData, error: habitError } = await supabase
                .from('homework_problem_options' as any)
                .select('*')
                .order('created_at', { ascending: true });

            if (habitError) throw habitError;
            setHabitOptions(habitData as any || []);

        } catch (err) {
            console.error('Error fetching initial data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const matchesClass = selectedClass === 'all' || s.class === selectedClass;
            const matchesSearch = !studentSearch ||
                (s.display_name?.toLowerCase().includes(studentSearch.toLowerCase()) || false);
            return matchesClass && matchesSearch;
        });
    }, [students, selectedClass, studentSearch]);

    const handleToggleCell = (studentId: string, habitId: string) => {
        setMatrix(prev => {
            const studentRow = prev[studentId] || {};
            return {
                ...prev,
                [studentId]: {
                    ...studentRow,
                    [habitId]: !studentRow[habitId]
                }
            };
        });
    };

    const handleAddHabit = async () => {
        if (!newHabitLabel.trim()) return;
        
        try {
            const { data, error } = await supabase
                .from('homework_problem_options' as any)
                .insert([
                    { label: newHabitLabel.trim(), category: 'Custom', created_by: user?.id }
                ])
                .select();

            if (error) throw error;
            if (data) {
                setHabitOptions(prev => [...prev, ...data] as any);
                setNewHabitLabel('');
                setIsAddingHabit(false);
            }
        } catch (err) {
            console.error('Error adding habit:', err);
            alert('Failed to add habit option');
        }
    };

    const handleUpdateOption = async (id: string, newLabel: string) => {
        if (!newLabel.trim()) return;

        try {
            const { error } = await supabase
                .from('homework_problem_options' as any)
                .update({ label: newLabel.trim() })
                .eq('id', id);

            if (error) throw error;

            setHabitOptions(prev => prev.map(opt =>
                opt.id === id ? { ...opt, label: newLabel.trim() } : opt
            ));
            setEditingOptionId(null);
        } catch (err) {
            console.error('Error updating habit:', err);
            alert('Failed to update habit');
        }
    };

    const handleDeleteOption = async (id: string, label: string) => {
        if (!confirm(`Are you sure you want to delete "${label}"? This will NOT remove historic records but will stop tracking it in the matrix.`)) return;

        try {
            const { error } = await supabase
                .from('homework_problem_options' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;

            setHabitOptions(prev => prev.filter(opt => opt.id !== id));
            // Also clean up matrix state if any
            setMatrix(prev => {
                const newMatrix = { ...prev };
                Object.keys(newMatrix).forEach(sId => {
                    if (newMatrix[sId][id]) {
                        delete newMatrix[sId][id];
                    }
                });
                return newMatrix;
            });
        } catch (err) {
            console.error('Error deleting habit:', err);
            alert('Failed to delete habit');
        }
    };

    const handleSaveAll = async () => {
        if (!homeworkTitle.trim()) {
            alert('Please enter a Homework Title (e.g. GE(A))');
            return;
        }

        const studentIdsWithMarks = Object.keys(matrix).filter(sId => 
            Object.values(matrix[sId]).some(val => val === true)
        );

        if (studentIdsWithMarks.length === 0) {
            alert('No errors marked. Please mark at least one student.');
            return;
        }

        setIsSaving(true);
        try {
            const recordsToInsert = studentIdsWithMarks.map(studentId => {
                const checkedHabits = habitOptions
                    .filter(opt => matrix[studentId][opt.id])
                    .map(opt => opt.label);
                
                const message = `${homeworkTitle}: ${checkedHabits.join(', ')}`;
                
                return {
                    student_id: studentId,
                    message,
                    type: 'neutral' as const, // Habit logs are usually informational
                    assigned_at: new Date(assignedDate).toISOString(),
                    created_by: user?.id
                };
            });

            const { error } = await supabase
                .from('student_records')
                .insert(recordsToInsert);

            if (error) throw error;

            playSuccessSound();
            alert(`Record saved for ${studentIdsWithMarks.length} students!`);
            
            // Clear selections after save
            setMatrix({});
            setHomeworkTitle('');
            
        } catch (err) {
            console.error('Error saving records:', err);
            alert('Failed to save records');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <AdminLayout title="Homework Habit Tracker" icon={<LayoutGrid className="w-6 h-6" />}>
                <div className="flex flex-col items-center justify-center h-96 gap-4">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Initializing Habit Matrix...</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Homework Habit Tracker" icon={<LayoutGrid className="w-6 h-6" />}>
            <div className="p-4 md:p-8 max-w-[100vw] overflow-x-hidden font-sans space-y-6">
                
                {/* Header Config Section */}
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-wrap gap-8 items-end">
                    <div className="space-y-3 flex-1 min-w-[200px]">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">
                            Assignment Title
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. GE(A) / Vocab WB"
                            value={homeworkTitle}
                            onChange={(e) => setHomeworkTitle(e.target.value)}
                            className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 font-black text-slate-700 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all shadow-inner placeholder:text-slate-300"
                        />
                    </div>

                    <div className="space-y-3 w-fit shrink-0">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">
                            Assigned Date
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="date"
                                value={assignedDate}
                                onChange={(e) => setAssignedDate(e.target.value)}
                                className="pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 font-black text-slate-700 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="space-y-3 w-fit shrink-0">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">
                            Class
                        </label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="px-6 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 font-black text-slate-700 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all shadow-inner"
                        >
                            {classes.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleSaveAll}
                        disabled={isSaving || !homeworkTitle.trim()}
                        className="h-[60px] px-10 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:shadow-xl hover:bg-blue-700 disabled:opacity-40 disabled:shadow-none transition-all flex items-center gap-3 active:scale-95"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        Save All Records
                    </button>
                </div>

                {/* Matrix Table Area */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden max-h-[70vh]">
                    
                    {/* Search Bar for students inside table area */}
                    <div className="p-4 border-b border-slate-50 bg-white flex items-center justify-between sticky top-0 z-40">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search student name..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 rounded-xl border-2 border-slate-50 bg-slate-50/50 text-sm font-bold focus:outline-none focus:border-blue-200 focus:bg-white transition-all"
                            />
                        </div>
                        <div className="flex gap-2">
                             {/* Mode Toggle Actions */}
                             <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => {
                                        setIsEditMode(!isEditMode);
                                        setIsDeleteMode(false);
                                        setEditingOptionId(null);
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${isEditMode ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-blue-600'}`}
                                >
                                    <Pencil size={12} />
                                    <span>{isEditMode ? 'Finish' : 'Edit'}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsDeleteMode(!isDeleteMode);
                                        setIsEditMode(false);
                                        setEditingOptionId(null);
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${isDeleteMode ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-rose-600'}`}
                                >
                                    <Trash2 size={12} />
                                    <span>{isDeleteMode ? 'Finish' : 'Delete'}</span>
                                </button>
                             </div>

                             <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                                {filteredStudents.length} Students
                             </div>
                        </div>
                    </div>

                    <div className="overflow-auto custom-scrollbar flex-1 relative min-h-[400px]">
                        <table className="w-full border-collapse table-fixed min-w-[1000px]">
                            <thead>
                                <tr className="sticky top-0 z-[35] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                                    <th className="w-[200px] sticky left-0 z-50 bg-white p-6 border-b-2 border-slate-50 text-left">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Settings2 size={16} />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Student</span>
                                        </div>
                                    </th>
                                    {habitOptions.map(opt => {
                                        const count = Object.values(matrix).filter(row => row[opt.id]).length;
                                        return (
                                            <th key={opt.id} className={`min-w-[140px] p-4 border-b-2 border-slate-50 text-center transition-all ${isDeleteMode ? 'bg-rose-50/50' : isEditMode ? 'bg-blue-50/50' : ''}`}>
                                                <div className="relative group max-w-[120px] mx-auto">
                                                    {editingOptionId === opt.id ? (
                                                        <div className="flex items-center gap-1 p-1 bg-white rounded-lg border-2 border-blue-400 shadow-sm animate-in zoom-in duration-200">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                value={editingLabelValue}
                                                                onChange={(e) => setEditingLabelValue(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleUpdateOption(opt.id, editingLabelValue);
                                                                    if (e.key === 'Escape') setEditingOptionId(null);
                                                                }}
                                                                className="w-full bg-transparent border-none outline-none text-[10px] font-black px-1"
                                                            />
                                                            <button onClick={() => handleUpdateOption(opt.id, editingLabelValue)} className="text-emerald-500 hover:bg-emerald-50 p-0.5 rounded-md">
                                                                <Check size={12} strokeWidth={4} />
                                                            </button>
                                                        </div>
                                                    ) : isEditMode ? (
                                                        <button
                                                            onClick={() => {
                                                                setEditingOptionId(opt.id);
                                                                setEditingLabelValue(opt.label);
                                                            }}
                                                            className="w-full text-[10px] font-black text-blue-600 uppercase tracking-widest break-words leading-tight hover:underline flex items-center justify-center gap-1.5"
                                                        >
                                                            <span>{opt.label}</span>
                                                            <Pencil size={10} className="shrink-0" />
                                                        </button>
                                                    ) : isDeleteMode ? (
                                                        <button
                                                            onClick={() => handleDeleteOption(opt.id, opt.label)}
                                                            className="w-full text-[10px] font-black text-rose-600 uppercase tracking-widest break-words leading-tight hover:bg-rose-100 p-2 rounded-lg flex items-center justify-center gap-1.5"
                                                        >
                                                            <span>{opt.label}</span>
                                                            <Trash2 size={10} className="shrink-0" />
                                                        </button>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest break-words leading-tight">
                                                                {opt.label}
                                                            </div>
                                                            {count > 0 && (
                                                                <div className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black rounded-lg border border-blue-100 animate-in fade-in zoom-in">
                                                                    {count} MARKED
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                    <th className="w-[200px] p-6 border-b-2 border-slate-50 text-center">
                                        {isAddingHabit ? (
                                            <div className="flex items-center gap-2 p-1 bg-blue-50 rounded-xl animate-in fade-in zoom-in duration-200">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Error label..."
                                                    value={newHabitLabel}
                                                    onChange={(e) => setNewHabitLabel(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddHabit()}
                                                    className="w-full bg-transparent border-none outline-none text-[10px] font-black px-2 py-1 placeholder:text-blue-300"
                                                />
                                                <button onClick={handleAddHabit} className="p-1 text-blue-600 hover:bg-blue-100 rounded-lg">
                                                    <Check size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setIsAddingHabit(true)}
                                                className="w-full py-2 bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-200 transition-all flex items-center justify-center gap-2 group"
                                            >
                                                <Plus size={14} className="group-hover:rotate-90 transition-transform" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Add Error</span>
                                            </button>
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredStudents.map(student => (
                                    <tr key={student.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="sticky left-0 z-20 bg-white p-4 font-black text-slate-700 text-sm group-hover:bg-slate-100/50 transition-colors border-r border-slate-50/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-100 font-black text-[10px] text-slate-400 flex items-center justify-center shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:scale-105">
                                                    {student.class_number || '•'}
                                                </div>
                                                <span className="tracking-tight">{student.display_name}</span>
                                            </div>
                                        </td>
                                        {habitOptions.map(opt => (
                                            <td key={opt.id} className="p-0 border-r border-slate-50/50">
                                                <div 
                                                    onClick={() => handleToggleCell(student.id, opt.id)}
                                                    className={`w-full h-[64px] flex items-center justify-center cursor-pointer transition-all border-b border-transparent
                                                        ${matrix[student.id]?.[opt.id] ? 'bg-blue-50/50' : 'hover:bg-blue-50/20'}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all transform
                                                        ${matrix[student.id]?.[opt.id] 
                                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' 
                                                            : 'bg-white border-2 border-slate-100 text-slate-200 group-hover:border-slate-200 group-hover:scale-105'}`}>
                                                        {matrix[student.id]?.[opt.id] ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </div>
                                                </div>
                                            </td>
                                        ))}
                                        <td className="p-0 bg-slate-50/30">
                                            {/* Empty spacer for the 'Add Error' column */}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-blue-800 text-xs font-bold leading-relaxed">
                    <CheckSquare size={16} className="shrink-0" />
                    <p>
                        <span className="uppercase tracking-widest font-black mr-2">Pro Tip:</span>
                        Start typing a new error label and press Enter to quickly add columns. All marks will be saved as a single summary record to each student's log.
                    </p>
                </div>
            </div>
        </AdminLayout>
    );
}
