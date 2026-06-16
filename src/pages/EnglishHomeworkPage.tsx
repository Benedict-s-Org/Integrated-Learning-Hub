import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { BookOpen, Check, AlertTriangle, AlertCircle, RefreshCw, X, Plus, Clock, FileText, Bookmark, Calendar } from 'lucide-react';
import { getHKTodayString } from '@/utils/dateUtils';
import { playSuccessSound } from '@/utils/audio';

type EnglishMaterial = {
    id: string;
    name: string;
    subject: string;
    type: string | null;
    is_active: boolean;
    sort_order: number;
};

type EnglishSubmission = {
    id: string;
    student_id: string;
    material_id: string;
    record_date: string;
    class: string;
    status: 'submitted' | 'missing' | 'made_up' | 'needs_correction' | 'corrected' | 'absent';
    made_up_date: string | null;
    late_days: number | null;
    needs_correction_followup: boolean;
    followup_started_at: string | null;
    followup_notes: string | null;
};

type Student = {
    id: string;
    display_name: string;
    class_number: number;
    class: string;
};

export function EnglishHomeworkPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedClass, setSelectedClass] = useState<string>(searchParams.get('class') || '3A');
    const [selectedDate, setSelectedDate] = useState<string>(getHKTodayString());
    const [activeTab, setActiveTab] = useState<'submissions' | 'followup' | 'materials'>('submissions');
    
    const [allClasses, setAllClasses] = useState<string[]>(['3A']);
    const [materials, setMaterials] = useState<EnglishMaterial[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [submissions, setSubmissions] = useState<EnglishSubmission[]>([]);
    const [followupQueue, setFollowupQueue] = useState<EnglishSubmission[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [newMaterialName, setNewMaterialName] = useState('');

    useEffect(() => {
        fetchClasses();
        fetchMaterials();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            setSearchParams({ class: selectedClass });
            if (activeTab === 'submissions') {
                fetchStudentsAndSubmissions();
            } else if (activeTab === 'followup') {
                fetchFollowupQueue();
            }
        }
    }, [selectedClass, selectedDate, activeTab]);

    const fetchClasses = async () => {
        const { data } = await supabase.from('users').select('class').not('class', 'is', null);
        if (data) {
            const unique = Array.from(new Set(data.map(d => d.class))).filter(Boolean) as string[];
            setAllClasses(unique.sort());
        }
    };

    const fetchMaterials = async () => {
        const { data } = await supabase.from('english_materials').select('*').eq('is_active', true).order('sort_order');
        if (data) setMaterials(data);
    };

    const fetchStudentsAndSubmissions = async () => {
        setIsLoading(true);
        const { data: usersData } = await supabase
            .from('users')
            .select('id, display_name, class_number, class')
            .eq('class', selectedClass)
            .eq('role', 'user')
            .order('class_number');
        if (usersData) setStudents(usersData);

        const { data: subsData } = await supabase.rpc('get_english_submissions', {
            p_class: selectedClass,
            p_start: selectedDate,
            p_end: selectedDate
        });
        if (subsData) setSubmissions(subsData);
        setIsLoading(false);
    };

    const fetchFollowupQueue = async () => {
        setIsLoading(true);
        const { data } = await supabase.rpc('get_english_followup_queue', {
            p_class: selectedClass
        });
        if (data) setFollowupQueue(data);
        
        // Ensure students are loaded for displaying names
        if (students.length === 0) {
            const { data: usersData } = await supabase
                .from('users')
                .select('id, display_name, class_number, class')
                .eq('class', selectedClass)
                .eq('role', 'user')
                .order('class_number');
            if (usersData) setStudents(usersData);
        }
        setIsLoading(false);
    };

    const handleAddMaterial = async () => {
        if (!newMaterialName.trim()) return;
        try {
            await supabase.rpc('add_english_material', { p_name: newMaterialName.trim() });
            setNewMaterialName('');
            await fetchMaterials();
            playSuccessSound();
        } catch (e: any) {
            alert('Failed: ' + e.message);
        }
    };

    const handleArchiveMaterial = async (id: string) => {
        if (!confirm('Are you sure you want to archive this material?')) return;
        try {
            await supabase.rpc('archive_english_material', { p_material_id: id });
            await fetchMaterials();
        } catch (e: any) {
            alert('Failed: ' + e.message);
        }
    };

    const updateSubmissionStatus = async (studentId: string, materialId: string, newStatus: string) => {
        try {
            let madeUpDate = null;
            if (newStatus === 'made_up') {
                madeUpDate = getHKTodayString();
            }
            await supabase.rpc('upsert_english_submission', {
                p_student_id: studentId,
                p_material_id: materialId,
                p_record_date: selectedDate,
                p_class: selectedClass,
                p_status: newStatus,
                p_made_up_date: madeUpDate
            });
            await fetchStudentsAndSubmissions();
            playSuccessSound();
        } catch (e: any) {
            alert('Error updating status: ' + e.message);
        }
    };

    const toggleFollowup = async (sub: EnglishSubmission) => {
        try {
            await supabase.rpc('set_english_correction_followup', {
                p_submission_id: sub.id,
                p_value: !sub.needs_correction_followup
            });
            if (activeTab === 'followup') {
                await fetchFollowupQueue();
            } else {
                await fetchStudentsAndSubmissions();
            }
        } catch (e: any) {
            alert('Error toggling followup: ' + e.message);
        }
    };

    const markCorrected = async (sub: EnglishSubmission) => {
        try {
            await supabase.rpc('upsert_english_submission', {
                p_student_id: sub.student_id,
                p_material_id: sub.material_id,
                p_record_date: sub.record_date,
                p_class: sub.class,
                p_status: 'corrected',
                p_made_up_date: sub.made_up_date
            });
            await supabase.rpc('set_english_correction_followup', {
                p_submission_id: sub.id,
                p_value: false
            });
            if (activeTab === 'followup') {
                await fetchFollowupQueue();
            } else {
                await fetchStudentsAndSubmissions();
            }
            playSuccessSound();
        } catch (e: any) {
            alert('Error updating status: ' + e.message);
        }
    };

    const getStudentName = (id: string) => students.find(s => s.id === id)?.display_name || 'Unknown';
    const getStudentNum = (id: string) => students.find(s => s.id === id)?.class_number || '-';
    const getMaterialName = (id: string) => materials.find(m => m.id === id)?.name || 'Unknown';

    // Group submissions by material for Tracker view
    const materialsWithSubmissions = materials.filter(m => 
        submissions.some(s => s.material_id === m.id && s.status !== 'absent')
    );

    return (
        <AdminLayout title="English Homework Tracker" icon={<BookOpen />}>
            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
                
                {/* Header Controls */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('submissions')}
                            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'submissions' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Calendar size={18} /> Daily Tracker
                        </button>
                        <button
                            onClick={() => setActiveTab('followup')}
                            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'followup' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <AlertTriangle size={18} /> Correction Queue
                        </button>
                        <button
                            onClick={() => setActiveTab('materials')}
                            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'materials' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Bookmark size={18} /> Materials Admin
                        </button>
                    </div>

                    <div className="flex gap-4 items-center">
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
                        >
                            {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {activeTab === 'submissions' && (
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
                            />
                        )}
                    </div>
                </div>

                {isLoading && (
                    <div className="flex justify-center p-12">
                        <RefreshCw className="animate-spin text-slate-400" size={32} />
                    </div>
                )}

                {/* Submissions Tab */}
                {!isLoading && activeTab === 'submissions' && (
                    <div className="space-y-6">
                        {materialsWithSubmissions.length === 0 ? (
                            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500">
                                <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="font-bold text-lg">No English missing items synced for this date.</p>
                                <p className="text-sm mt-2">Make sure students are marked as "Missing" with English homework items in the standard Morning Duties dashboard.</p>
                            </div>
                        ) : (
                            materialsWithSubmissions.map(material => {
                                const materialSubs = submissions.filter(s => s.material_id === material.id && s.status !== 'absent');
                                return (
                                    <div key={material.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 font-black text-lg text-slate-800">
                                            {material.name}
                                        </div>
                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {materialSubs.map(sub => (
                                                <div key={sub.id} className="border border-slate-200 rounded-xl p-4 space-y-4">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-black text-slate-800">{getStudentName(sub.student_id)}</p>
                                                            <p className="text-xs text-slate-500 font-bold">#{getStudentNum(sub.student_id)}</p>
                                                        </div>
                                                        <div className={`px-2 py-1 rounded text-xs font-bold ${
                                                            sub.status === 'missing' ? 'bg-red-100 text-red-700' :
                                                            sub.status === 'made_up' ? 'bg-yellow-100 text-yellow-700' :
                                                            sub.status === 'needs_correction' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-green-100 text-green-700'
                                                        }`}>
                                                            {sub.status.toUpperCase().replace('_', ' ')}
                                                            {sub.late_days ? ` (+${sub.late_days}d)` : ''}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {sub.status === 'missing' && (
                                                            <button onClick={() => updateSubmissionStatus(sub.student_id, sub.material_id, 'made_up')} className="px-3 py-1.5 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg text-sm font-bold transition-all">
                                                                補交 (Made Up)
                                                            </button>
                                                        )}
                                                        {(sub.status === 'missing' || sub.status === 'made_up') && (
                                                            <button onClick={() => updateSubmissionStatus(sub.student_id, sub.material_id, 'needs_correction')} className="px-3 py-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg text-sm font-bold transition-all">
                                                                要改正 (Needs Correction)
                                                            </button>
                                                        )}
                                                        {sub.status !== 'corrected' && sub.status !== 'missing' && (
                                                            <button onClick={() => markCorrected(sub)} className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-bold transition-all">
                                                                已改正 (Corrected)
                                                            </button>
                                                        )}
                                                        
                                                        {/* Followup Toggle */}
                                                        {sub.status !== 'corrected' && (
                                                            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 ml-auto transition-all">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={sub.needs_correction_followup}
                                                                    onChange={() => toggleFollowup(sub)}
                                                                    className="w-4 h-4 rounded text-blue-600"
                                                                />
                                                                <span className="text-sm font-bold text-slate-600">需跟進</span>
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Followup Queue Tab */}
                {!isLoading && activeTab === 'followup' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-orange-50 px-6 py-4 border-b border-orange-200 flex justify-between items-center">
                            <h2 className="font-black text-lg text-orange-800 flex items-center gap-2">
                                <AlertTriangle /> 需跟進名單 (Correction Follow-up Queue)
                            </h2>
                            <span className="bg-orange-200 text-orange-800 px-3 py-1 rounded-full text-sm font-bold">
                                {followupQueue.length} Items
                            </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {followupQueue.length === 0 ? (
                                <div className="p-12 text-center text-slate-500 font-bold">Queue is empty! Great job.</div>
                            ) : (
                                followupQueue.map(sub => (
                                    <div key={sub.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-black text-xl">
                                                {getStudentNum(sub.student_id)}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-800 text-lg">{getStudentName(sub.student_id)}</h3>
                                                <p className="text-slate-500 font-medium">
                                                    {getMaterialName(sub.material_id)} 
                                                    <span className="mx-2 text-slate-300">|</span> 
                                                    Assigned: <span className="font-bold">{sub.record_date}</span>
                                                </p>
                                                <div className="mt-2 text-sm font-bold text-orange-600 flex items-center gap-1">
                                                    <Clock size={14} /> Follow-up started: {new Date(sub.followup_started_at || '').toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={() => toggleFollowup(sub)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all">
                                                取消跟進 (Unmark)
                                            </button>
                                            <button onClick={() => markCorrected(sub)} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all flex items-center gap-2">
                                                <Check size={16} /> 已改正 (Corrected)
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Materials Admin Tab */}
                {activeTab === 'materials' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
                        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex gap-3">
                            <AlertCircle className="shrink-0" />
                            <div>
                                <p className="font-bold">教材詳情（Book／頁數／要交日期）在 Notion 維護，這裡只管名稱。</p>
                                <p className="text-sm mt-1 opacity-80">This list determines what is syncable from the standard Morning Duties UI to the English Tracker.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={newMaterialName}
                                onChange={e => setNewMaterialName(e.target.value)}
                                placeholder="Enter material name (e.g. GE(A))"
                                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500"
                                onKeyDown={e => e.key === 'Enter' && handleAddMaterial()}
                            />
                            <button onClick={handleAddMaterial} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 flex items-center gap-2">
                                <Plus size={20} /> Add Material
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {materials.map(m => (
                                <div key={m.id} className="border border-slate-200 p-4 rounded-xl flex justify-between items-center group hover:border-blue-300 hover:shadow-md transition-all">
                                    <div className="font-bold text-slate-700">{m.name}</div>
                                    <button 
                                        onClick={() => handleArchiveMaterial(m.id)}
                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Archive Material"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </AdminLayout>
    );
}
