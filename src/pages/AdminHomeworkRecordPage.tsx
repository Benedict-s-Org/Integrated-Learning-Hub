import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ClipboardList, Plus, Check, Search, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_SUB_OPTIONS, SUBJECT_NAMES } from '@/constants/rewardConfig';
import { useAuth } from '@/context/AuthContext';
import { playSuccessSound } from '@/utils/audio';

interface Student {
    id: string;
    display_name: string | null;
    class: string | null;
    class_number: number | null;
}

export default function AdminHomeworkRecordPage() {
    const { user } = useAuth();
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [selectedSubject, setSelectedSubject] = useState<string>(SUBJECT_NAMES.ENGLISH);
    const [selectedSubOption, setSelectedSubOption] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [pageNumber, setPageNumber] = useState('');
    const [remarks, setRemarks] = useState('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

    // Problems (Step 5)
    interface ProblemOption {
        id: string;
        label: string;
        category: string | null;
    }
    const [problemOptions, setProblemOptions] = useState<ProblemOption[]>([]);
    const [checkedProblems, setCheckedProblems] = useState<Set<string>>(new Set());
    const [inlineNewOptionLabel, setInlineNewOptionLabel] = useState('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [buttonWidth, setButtonWidth] = useState(() => {
        const saved = localStorage.getItem('homework_button_width');
        return saved ? parseInt(saved) : 160;
    });
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStartClientX, setResizeStartClientX] = useState(0);
    const [resizeStartWidth, setResizeStartWidth] = useState(0);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
    const [editingLabelValue, setEditingLabelValue] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [studentSearch, setStudentSearch] = useState('');

    useEffect(() => {
        fetchInitialData();
        fetchProblemOptions();
    }, []);

    useEffect(() => {
        // Reset sub-option when subject changes
        setSelectedSubOption('');
    }, [selectedSubject]);

    const fetchInitialData = async () => {
        try {
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
            if (uniqueClasses.length > 0) setSelectedClass(uniqueClasses[0]);

        } catch (err) {
            console.error('Error fetching data:', err);
        }
    };

    const fetchProblemOptions = async () => {
        try {
            const { data, error } = await supabase
                .from('homework_problem_options' as any)
                .select('*')
                .order('created_at', { ascending: true });

            if (error) throw error;
            setProblemOptions(data as any || []);
        } catch (err) {
            console.error('Error fetching problem options:', err);
        }
    };

    const groupedOptions = useMemo(() => {
        const topLevel: ProblemOption[] = [];
        const subOptionsMap: Record<string, ProblemOption[]> = {};

        problemOptions.forEach(opt => {
            if (!opt.category) {
                topLevel.push(opt);
            } else {
                if (!subOptionsMap[opt.category]) subOptionsMap[opt.category] = [];
                subOptionsMap[opt.category].push(opt);
            }
        });

        return { topLevel, subOptionsMap };
    }, [problemOptions]);

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const matchesClass = selectedClass === 'all' || s.class === selectedClass;
            const matchesSearch = !studentSearch ||
                (s.display_name?.toLowerCase().includes(studentSearch.toLowerCase()) || false);
            return matchesClass && matchesSearch;
        });
    }, [students, selectedClass, studentSearch]);

    const handleToggleStudent = (id: string) => {
        const newSet = new Set(selectedStudentIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedStudentIds(newSet);
    };

    const handleSelectAllFiltered = () => {
        const newSet = new Set(selectedStudentIds);
        filteredStudents.forEach(s => newSet.add(s.id));
        setSelectedStudentIds(newSet);
    };

    const handleDeselectAllFiltered = () => {
        const newSet = new Set(selectedStudentIds);
        filteredStudents.forEach(s => newSet.delete(s.id));
        setSelectedStudentIds(newSet);
    };

    const handleToggleProblem = (label: string) => {
        const newSet = new Set(checkedProblems);
        if (newSet.has(label)) newSet.delete(label);
        else newSet.add(label);
        setCheckedProblems(newSet);
    };

    const handleToggleCategory = (category: string) => {
        const newSet = new Set(expandedCategories);
        if (newSet.has(category)) newSet.delete(category);
        else newSet.add(category);
        setExpandedCategories(newSet);
    };

    const handleAddOption = async (label: string, category: string | null) => {
        if (!label.trim()) return;

        try {
            const { data, error } = await supabase
                .from('homework_problem_options' as any)
                .insert([
                    { label: label.trim(), category: category, created_by: user?.id }
                ])
                .select();

            if (error) throw error;

            if (data) {
                setProblemOptions(prev => [...prev, ...data] as any);
                if (category) {
                    setExpandedCategories(prev => new Set(prev).add(category));
                }
            }
        } catch (error) {
            console.error('Error adding option:', error);
        }
    };


    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - resizeStartClientX;
            const newWidth = Math.max(80, Math.min(400, resizeStartWidth + delta));
            setButtonWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            // We use the functional update to get the latest width for persistence
            setButtonWidth(finalWidth => {
                localStorage.setItem('homework_button_width', finalWidth.toString());
                return finalWidth;
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, resizeStartClientX, resizeStartWidth]);

    const handleUpdateOption = async (id: string, newLabel: string) => {
        if (!newLabel.trim()) return;

        try {
            const { error } = await supabase
                .from('homework_problem_options' as any)
                .update({ label: newLabel.trim() })
                .eq('id', id);

            if (error) throw error;

            setProblemOptions(prev => prev.map(opt =>
                opt.id === id ? { ...opt, label: newLabel.trim() } : opt
            ));
            setEditingOptionId(null);
        } catch (error) {
            console.error('Error updating option:', error);
        }
    };

    const handleDeleteCategory = async (category: string) => {
        if (!confirm(`Are you sure you want to delete the category "${category}" and ALL its options?`)) return;

        try {
            const { error } = await supabase
                .from('homework_problem_options' as any)
                .delete()
                .eq('category', category);

            if (error) throw error;

            setProblemOptions(prev => prev.filter(opt => opt.category !== category));
            const newExpanded = new Set(expandedCategories);
            newExpanded.delete(category);
            setExpandedCategories(newExpanded);
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    };

    const handleDeleteOption = async (id: string) => {
        if (!confirm('Are you sure you want to delete this option?')) return;

        try {
            const { error } = await supabase
                .from('homework_problem_options' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;

            setProblemOptions(prev => prev.filter(opt => opt.id !== id));
        } catch (error) {
            console.error('Error deleting option:', error);
        }
    };

    const handleSave = async () => {
        if (selectedStudentIds.size === 0) {
            alert('Please select at least one student');
            return;
        }
        if (!selectedSubOption) {
            alert('Please select a homework type in Step 2');
            return;
        }
        if (!pageNumber.trim()) {
            alert('Please enter a Page / Exercise Number');
            return;
        }

        setIsSaving(true);
        try {
            const problemsStr = Array.from(checkedProblems).join(', ');
            const title = `${selectedSubject} - ${selectedSubOption}: ${pageNumber}`;
            const fullMessage = `${title}${problemsStr ? ` (Problems: ${problemsStr})` : ''}${remarks ? ` - ${remarks}` : ''}`;

            const records = Array.from(selectedStudentIds).map(studentId => ({
                student_id: studentId,
                message: fullMessage,
                type: 'positive' as const, // Homework completion is generally recorded even if there are remarks
                created_by: user?.id,
                created_at: new Date().toISOString()
            }));

            const { error } = await supabase
                .from('student_records')
                .insert(records);

            if (error) throw error;

            playSuccessSound();
            alert(`Record saved for ${selectedStudentIds.size} students!`);

            setSelectedStudentIds(new Set());
            setPageNumber('');
            setRemarks('');
            setCheckedProblems(new Set());
            setSelectedSubOption('');

        } catch (err) {
            console.error('Error saving records:', err);
            alert('Failed to save record');
        } finally {
            setIsSaving(false);
        }
    };

    const availableSubOptions = DEFAULT_SUB_OPTIONS[selectedSubject] || [];

    return (
        <AdminLayout title="Homework Record" icon={<ClipboardList className="w-6 h-6" />}>
            <div className="p-4 md:p-8 max-w-7xl mx-auto font-sans">
                <div className="bg-white rounded-[32px] border-4 border-white shadow-2xl shadow-slate-200/60 overflow-hidden flex flex-col h-auto lg:h-[900px]">

                    {/* Top Section: Steps 1-3 (Full Width, Vertical Stack) */}
                    <div className="p-6 md:p-8 border-b-2 border-slate-100 bg-slate-50/50 flex flex-col gap-6 shrink-0 z-10">
                        {/* Step 1: Class */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] block">1. Select Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="w-full md:w-1/2 lg:w-1/3 px-4 py-3 rounded-xl border-2 border-slate-200 bg-white font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all text-sm shadow-sm"
                            >
                                <option value="all">All Classes</option>
                                {classes.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* Step 2: Subject & Suboption */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] block">2. Select Subject & Homework Type</label>
                            <div className="flex gap-2">
                                {[SUBJECT_NAMES.ENGLISH, SUBJECT_NAMES.OTHER].map(sub => (
                                    <button
                                        key={sub}
                                        onClick={() => setSelectedSubject(sub)}
                                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${selectedSubject === sub
                                            ? 'bg-slate-800 text-white shadow-md transform scale-[1.02]'
                                            : 'bg-white border-2 border-slate-200 text-slate-500 hover:border-slate-300'
                                            }`}
                                    >
                                        {sub}
                                    </button>
                                ))}
                            </div>

                            {/* Suboptions rendering */}
                            {availableSubOptions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200/60">
                                    {availableSubOptions.map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => setSelectedSubOption(opt)}
                                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${selectedSubOption === opt
                                                ? 'bg-blue-50 border-blue-400 text-blue-700 scale-[1.02] shadow-sm'
                                                : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Step 3: Page Number */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] block">3. Input Page / Ex. Number</label>
                            <input
                                type="text"
                                placeholder="e.g. Page 12"
                                value={pageNumber}
                                onChange={(e) => setPageNumber(e.target.value)}
                                className="w-full md:w-1/2 lg:w-1/3 px-4 py-3 rounded-xl border-2 border-slate-200 bg-white font-black text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all text-sm shadow-sm placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    {/* Bottom Section: Steps 4-6 (Split View) */}
                    <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">

                        {/* Left Panel: Step 4 (1/4 Width) */}
                        <div className="lg:w-1/4 flex flex-col border-r-2 border-slate-100 bg-white z-0">
                            <div className="p-6 border-b border-slate-100 bg-white shrink-0">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">4. Select Students ({selectedStudentIds.size})</h3>
                                <div className="bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2.5 flex items-center gap-2 mb-3 shadow-inner">
                                    <Search size={14} className="text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search class..."
                                        value={studentSearch}
                                        onChange={(e) => setStudentSearch(e.target.value)}
                                        className="bg-transparent border-none outline-none text-xs font-black w-full"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={handleSelectAllFiltered} className="text-[10px] font-black text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wider bg-blue-50 px-3 py-1.5 rounded-lg">Select All</button>
                                    <button onClick={handleDeselectAllFiltered} className="text-[10px] font-black text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded-lg">Clear All</button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 bg-slate-50/50 custom-scrollbar">
                                {filteredStudents.map(s => (
                                    <div
                                        key={s.id}
                                        onClick={() => handleToggleStudent(s.id)}
                                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border-2 ${selectedStudentIds.has(s.id)
                                            ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-sm'
                                            : 'bg-white border-slate-100 hover:border-slate-300 text-slate-600 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-colors ${selectedStudentIds.has(s.id) ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                {selectedStudentIds.has(s.id) ? <Check size={14} strokeWidth={4} /> : s.class_number}
                                            </div>
                                            <span className="font-bold text-sm tracking-tight">{s.display_name}</span>
                                        </div>
                                    </div>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <div className="text-center py-10 opacity-40 italic text-sm font-medium">No students match filter</div>
                                )}
                            </div>
                        </div>

                        {/* Right Panel: Steps 5-6 (3/4 Width) */}
                        <div className="lg:w-3/4 flex flex-col bg-slate-50 overflow-hidden">
                            {/* Step 5 & 6 Container */}
                            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                                {/* Header (Sticky/Fixed at top of panel) */}
                                <div className="p-6 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">5 & 6. Selection Options & Save</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setIsDeleteMode(!isDeleteMode);
                                                setIsEditMode(false);
                                                setEditingOptionId(null);
                                                setIsCreatingNew(false);
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${isDeleteMode ? 'bg-rose-500 text-white shadow-sm' : 'bg-white border border-rose-200 text-rose-500 hover:bg-rose-50'}`}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            <span>{isDeleteMode ? 'Finish Deleting' : 'Delete'}</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (isEditMode) {
                                                    setEditingOptionId(null);
                                                    setIsCreatingNew(false);
                                                }
                                                setIsEditMode(!isEditMode);
                                                setIsDeleteMode(false);
                                            }}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${isEditMode ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            <Plus className={`w-3 h-3 transition-transform ${isEditMode ? 'rotate-45' : ''}`} />
                                            <span>{isEditMode ? 'Finish Editing' : 'Edit Options'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Combined Scrollable Content: Options + Remark + Save */}
                                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
                                    {/* ── Unified Options List ── */}
                                    <div className="space-y-2">
                                        {groupedOptions.topLevel.map(opt => {
                                            const subOptions = groupedOptions.subOptionsMap[opt.label] || [];
                                            const hasSubOptions = subOptions.length > 0;

                                            return (
                                                <div key={opt.id}>
                                                    {hasSubOptions ? (
                                                        <div className="border-2 border-slate-100 rounded-[20px] overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
                                                            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between group">
                                                                <div
                                                                    onClick={() => {
                                                                        if (isDeleteMode) {
                                                                            handleDeleteCategory(opt.label);
                                                                        } else {
                                                                            handleToggleCategory(opt.label);
                                                                        }
                                                                    }}
                                                                    className="flex items-center gap-3 cursor-pointer flex-1"
                                                                >
                                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isDeleteMode ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                                                                        }`}>
                                                                        {isDeleteMode ? <Trash2 size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
                                                                    </div>
                                                                    <span className={`font-black text-sm tracking-tight ${isDeleteMode ? 'text-rose-600' : 'text-slate-800'}`}>{opt.label}</span>
                                                                    <div className={`transition-transform duration-300 ${expandedCategories.has(opt.label) ? 'rotate-180' : ''}`}>
                                                                        <svg width="10" height="6" viewBox="0 0 12 8" fill="none" className="stroke-slate-400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                            <path d="M1 1L6 6L11 1" />
                                                                        </svg>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        const label = prompt(`Add sub-option to "${opt.label}":`);
                                                                        if (label) handleAddOption(label, opt.label);
                                                                    }}
                                                                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all"
                                                                    title="Add Sub-option"
                                                                >
                                                                    <Plus size={14} strokeWidth={3} />
                                                                </button>
                                                            </div>
                                                            {expandedCategories.has(opt.label) && (
                                                                <div className="p-4 bg-white animate-in slide-in-from-top-1 duration-200">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {subOptions.map(sub => (
                                                                            <div
                                                                                key={sub.id}
                                                                                style={{ width: `${buttonWidth}px` }}
                                                                                className={`relative group shrink-0 ${isEditMode ? '' : 'cursor-pointer'}`}
                                                                            >
                                                                                {editingOptionId === sub.id ? (
                                                                                    <div className="flex items-center gap-1.5 p-1 rounded-xl border-2 border-blue-400 bg-white h-[42px] w-full">
                                                                                        <input autoFocus type="text" value={editingLabelValue} onChange={(e) => setEditingLabelValue(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleUpdateOption(sub.id, editingLabelValue)} onBlur={() => setEditingOptionId(null)} className="flex-1 bg-transparent border-none outline-none text-xs font-bold px-1.5 min-w-0" />
                                                                                        <button onClick={() => handleUpdateOption(sub.id, editingLabelValue)} className="text-emerald-500 hover:bg-emerald-50 p-1 rounded transition-colors"><Check size={14} strokeWidth={4} /></button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div
                                                                                        onClick={() => { if (isDeleteMode) { handleDeleteOption(sub.id); } else if (isEditMode) { setEditingOptionId(sub.id); setEditingLabelValue(sub.label); } else { handleToggleProblem(sub.label); } }}
                                                                                        className={`flex items-center gap-2 p-2.5 rounded-xl transition-all border-2 h-[42px] w-full ${isDeleteMode ? 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100' : checkedProblems.has(sub.label) ? 'bg-blue-50 border-blue-200 text-blue-800 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300 text-slate-600 hover:shadow-sm'}`}
                                                                                    >
                                                                                        {isDeleteMode ? (
                                                                                            <div className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 border-rose-500 bg-rose-500 text-white"><Trash2 size={10} strokeWidth={4} /></div>
                                                                                        ) : isEditMode ? (
                                                                                            <Plus className="w-3 h-3 text-slate-400 rotate-45" />
                                                                                        ) : (
                                                                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checkedProblems.has(sub.label) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-slate-50'}`}>
                                                                                                {checkedProblems.has(sub.label) && <Check size={11} strokeWidth={4} />}
                                                                                            </div>
                                                                                        )}
                                                                                        <span className="text-xs font-bold truncate">{sub.label}</span>
                                                                                    </div>
                                                                                )}
                                                                                {isEditMode && (
                                                                                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setResizeStartClientX(e.clientX); setResizeStartWidth(buttonWidth); setIsResizing(true); }} className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize z-20 hover:bg-blue-400/20 rounded-r-lg transition-colors" />
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{ width: `${buttonWidth}px` }} className={`relative group shrink-0 inline-block ${isEditMode ? '' : 'cursor-pointer'}`}>
                                                            {editingOptionId === opt.id ? (
                                                                <div className="flex items-center gap-1.5 p-1 rounded-xl border-2 border-blue-400 bg-white h-[42px] w-full">
                                                                    <input autoFocus type="text" value={editingLabelValue} onChange={(e) => setEditingLabelValue(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleUpdateOption(opt.id, editingLabelValue)} onBlur={() => setEditingOptionId(null)} className="flex-1 bg-transparent border-none outline-none text-xs font-bold px-1.5 min-w-0" />
                                                                    <button onClick={() => handleUpdateOption(opt.id, editingLabelValue)} className="text-emerald-500 hover:bg-emerald-50 p-1 rounded transition-colors"><Check size={14} strokeWidth={4} /></button>
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    onClick={() => { if (isDeleteMode) { handleDeleteOption(opt.id); } else if (isEditMode) { setEditingOptionId(opt.id); setEditingLabelValue(opt.label); } else { handleToggleProblem(opt.label); } }}
                                                                    className={`flex items-center gap-2 p-2.5 rounded-xl transition-all border-2 h-[42px] w-full ${isDeleteMode ? 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100' : checkedProblems.has(opt.label) ? 'bg-blue-50 border-blue-200 text-blue-800 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300 text-slate-600 hover:shadow-sm'}`}
                                                                >
                                                                    {isDeleteMode ? (
                                                                        <div className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 border-rose-500 bg-rose-500 text-white"><Trash2 size={10} strokeWidth={4} /></div>
                                                                    ) : isEditMode ? (
                                                                        <Plus className="w-3 h-3 text-slate-400 rotate-45" />
                                                                    ) : (
                                                                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checkedProblems.has(opt.label) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-slate-50'}`}>
                                                                            {checkedProblems.has(opt.label) && <Check size={11} strokeWidth={4} />}
                                                                        </div>
                                                                    )}
                                                                    <span className="text-xs font-bold truncate flex-1">{opt.label}</span>
                                                                    {!isDeleteMode && !isEditMode && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); const label = prompt(`Add sub-option to "${opt.label}":`); if (label) handleAddOption(label, opt.label); }}
                                                                            className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all shrink-0"
                                                                            title={`Add sub-option to ${opt.label}`}
                                                                        >
                                                                            <Plus size={11} strokeWidth={3} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {isEditMode && (
                                                                <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setResizeStartClientX(e.clientX); setResizeStartWidth(buttonWidth); setIsResizing(true); }} className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize z-20 hover:bg-blue-400/20 rounded-r-lg transition-colors" />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Inline Create New Button */}
                                        {(groupedOptions.topLevel.length > 0 || isEditMode || isCreatingNew) && (
                                            <div id="create-new-button" style={{ width: `${buttonWidth}px` }} className="relative group shrink-0 inline-block">
                                                {!isCreatingNew ? (
                                                    <button onClick={() => setIsCreatingNew(true)} className="w-full h-full min-h-[42px] flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-all text-xs font-black uppercase">
                                                        <Plus size={14} />
                                                        <span>Create New</span>
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 p-1 rounded-xl border-2 border-blue-400 bg-white h-full min-h-[42px]">
                                                        <input autoFocus type="text" value={inlineNewOptionLabel} onChange={(e) => setInlineNewOptionLabel(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddOption(inlineNewOptionLabel, null).then(() => { setInlineNewOptionLabel(''); setIsCreatingNew(false); })} className="flex-1 bg-transparent border-none outline-none text-xs font-bold px-1.5 min-w-0" placeholder="Name..." />
                                                        <button onClick={() => handleAddOption(inlineNewOptionLabel, null).then(() => { setInlineNewOptionLabel(''); setIsCreatingNew(false); })} className="text-emerald-500 hover:bg-emerald-50 p-1 rounded transition-colors"><Check size={14} strokeWidth={4} /></button>
                                                        <button onClick={() => { setIsCreatingNew(false); setInlineNewOptionLabel(''); }} className="text-rose-500 hover:bg-rose-50 p-1 rounded transition-colors">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                )}
                                                {isEditMode && (
                                                    <div onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setResizeStartClientX(e.clientX); setResizeStartWidth(buttonWidth); setIsResizing(true); }} className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize z-20 group-hover:bg-blue-400/10 rounded-r-lg" />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {problemOptions.length === 0 && (
                                        <div className="py-16 text-center border-4 border-dashed border-slate-100 rounded-[28px] bg-slate-50/30">
                                            <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-4 border-2 border-slate-100 text-slate-300">
                                                <Plus size={28} />
                                            </div>
                                            <div className="text-slate-400 font-black text-sm mb-1 tracking-tight">Setup Problem Tracker</div>
                                            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest max-w-xs mx-auto">Create a new option below to start tracking mistakes.</p>

                                            <button
                                                onClick={() => setIsCreatingNew(true)}
                                                className="mt-6 bg-blue-500 text-white px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider hover:bg-blue-600 transition-all shadow-md"
                                            >
                                                Create First Option
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {problemOptions.length === 0 && (
                                    <div className="py-16 text-center border-4 border-dashed border-slate-100 rounded-[28px] bg-slate-50/30">
                                        <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-4 border-2 border-slate-100 text-slate-300">
                                            <Plus size={28} />
                                        </div>
                                        <div className="text-slate-400 font-black text-sm mb-1 tracking-tight">Setup Problem Tracker</div>
                                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest max-w-xs mx-auto">Create a new option below to start tracking mistakes.</p>

                                        <button
                                            onClick={() => setIsCreatingNew(true)}
                                            className="mt-6 bg-blue-500 text-white px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider hover:bg-blue-600 transition-all shadow-md"
                                        >
                                            Create First Option
                                        </button>
                                    </div>
                                )}

                                {/* Combined Step 6 (Remark + Save) - Inside Scrollable Container */}
                                <div className="pt-6 border-t-2 border-slate-100">
                                    <div className="flex flex-col md:flex-row items-end gap-4">
                                        <div className="flex-1 space-y-2 w-full">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] block">6. Remark (Optional)</label>
                                            <input
                                                type="text"
                                                placeholder="Enter additional notes..."
                                                value={remarks}
                                                onChange={(e) => setRemarks(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-all text-sm shadow-inner placeholder:text-slate-400"
                                            />
                                        </div>


                                        <button
                                            disabled={isSaving || selectedStudentIds.size === 0 || !pageNumber.trim() || !selectedSubOption}
                                            onClick={handleSave}
                                            className="bg-blue-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-[0.15em] shadow-lg hover:shadow-xl hover:bg-blue-600 disabled:opacity-40 disabled:shadow-none transition-all flex items-center justify-center gap-3 active:scale-[0.98] text-sm whitespace-nowrap min-w-[180px]"
                                        >
                                            {isSaving ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-4 h-4 border-3 border-slate-600 border-t-white rounded-full animate-spin" />
                                                    <span>Saving...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <Save size={16} strokeWidth={3} />
                                                    <span>Save Record</span>
                                                    <div className="bg-white/20 px-2 py-0.5 rounded-lg text-[9px] backdrop-blur-md">
                                                        {selectedStudentIds.size}
                                                    </div>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout >
    );
}
