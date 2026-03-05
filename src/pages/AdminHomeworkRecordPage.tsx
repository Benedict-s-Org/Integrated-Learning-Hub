import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ClipboardList, Plus, Check, Search, Save } from 'lucide-react';
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
    const [customProblems, setCustomProblems] = useState<string[]>([]);
    const [checkedProblems, setCheckedProblems] = useState<Set<string>>(new Set());
    const [newProblemLabel, setNewProblemLabel] = useState('');
    const [studentSearch, setStudentSearch] = useState('');

    useEffect(() => {
        fetchInitialData();
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

    const handleToggleProblem = (opt: string) => {
        const newSet = new Set(checkedProblems);
        if (newSet.has(opt)) newSet.delete(opt);
        else newSet.add(opt);
        setCheckedProblems(newSet);
    };

    const handleAddNewProblem = () => {
        if (!newProblemLabel.trim()) return;
        if (!customProblems.includes(newProblemLabel.trim())) {
            setCustomProblems([...customProblems, newProblemLabel.trim()]);
        }
        setNewProblemLabel('');
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
            <div className="p-4 md:p-8 max-w-7xl mx-auto">
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
                                        className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border-2 ${selectedStudentIds.has(s.id)
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
                        <div className="lg:w-3/4 flex flex-col bg-slate-50">
                            {/* Step 5: Options (Problems) */}
                            <div className="flex-1 p-6 md:p-8 flex flex-col overflow-hidden bg-white">
                                <div className="flex items-center justify-between mb-6 shrink-0">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">5. Selection Options (Problems)</h3>
                                </div>

                                <div className="flex gap-3 mb-6 shrink-0 bg-slate-50 p-2 rounded-2xl border-2 border-slate-100 inline-flex w-fit max-w-full overflow-hidden">
                                    <input
                                        type="text"
                                        placeholder="Add problem (e.g. Tense)"
                                        value={newProblemLabel}
                                        onChange={(e) => setNewProblemLabel(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddNewProblem()}
                                        className="px-4 py-2 rounded-xl bg-white text-sm font-black outline-none focus:ring-2 focus:ring-blue-100 transition-all border border-slate-200 min-w-48 max-w-64"
                                    />
                                    <button
                                        onClick={handleAddNewProblem}
                                        className="bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-all shadow-sm active:scale-95 text-xs font-black uppercase tracking-wider flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <Plus size={16} strokeWidth={3} /> Add
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                                        {customProblems.map(opt => (
                                            <div
                                                key={opt}
                                                onClick={() => handleToggleProblem(opt)}
                                                className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all border-2 ${checkedProblems.has(opt)
                                                    ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-sm transform scale-[1.02]'
                                                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 hover:shadow-sm'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checkedProblems.has(opt) ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 bg-slate-50'
                                                    }`}>
                                                    {checkedProblems.has(opt) && <Check size={14} strokeWidth={4} />}
                                                </div>
                                                <span className="text-sm font-bold truncate">{opt}</span>
                                            </div>
                                        ))}
                                        {customProblems.length === 0 && (
                                            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                                <div className="text-slate-400 font-bold text-sm mb-1">No options created yet</div>
                                                <p className="text-[10px] font-black text-slate-400/80 uppercase tracking-widest">Add common problems using the input above</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Step 6: Remarks & Footer */}
                            <div className="p-6 md:p-8 border-t-2 border-slate-100 bg-white space-y-6 shrink-0 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)] z-10">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] block">6. Add Remark (Optional)</label>
                                    <textarea
                                        placeholder="Enter additional notes here..."
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                        className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 font-black text-slate-700 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all text-sm shadow-inner h-20 resize-none placeholder:text-slate-400"
                                    />
                                </div>

                                <button
                                    disabled={isSaving || selectedStudentIds.size === 0 || !pageNumber.trim() || !selectedSubOption}
                                    onClick={handleSave}
                                    className="w-full bg-slate-900 text-white py-4 md:py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg hover:shadow-xl hover:bg-slate-800 disabled:opacity-40 disabled:shadow-none transition-all flex items-center justify-center gap-4 active:scale-[0.98] text-sm"
                                >
                                    {isSaving ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-5 h-5 border-4 border-slate-600 border-t-white rounded-full animate-spin" />
                                            <span>Recording...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Save size={20} strokeWidth={3} />
                                            <span>Save Record</span>
                                            <div className="bg-white/20 px-3 py-1 rounded-lg text-xs backdrop-blur-md">
                                                {selectedStudentIds.size} Students
                                            </div>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>

                </div>
            </div>
        </AdminLayout>
    );
}
