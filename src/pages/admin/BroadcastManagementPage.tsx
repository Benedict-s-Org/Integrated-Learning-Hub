import { useState, useEffect, useMemo } from 'react';
import { Save, ListChecks, Calendar, CheckCircle2, Loader2, Layout, Plus, Check, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { getHKTodayString, getHKTodayStartISO } from '@/utils/dateUtils';
import { SUBJECT_NAMES } from '@/constants/rewardConfig';

interface Student {
    id: string;
    display_name: string;
    class: string;
}

interface StudentRef {
    name: string;
    className: string;
}

interface CustomBroadcast {
    id: string;
    message: string;
    students: StudentRef[];
    is_active: boolean;
}

interface BroadcastSettings {
    active_options: Record<string, string[]>; // class -> array of active IDs/messages (for presets)
    custom_broadcasts: CustomBroadcast[]; // global array of custom broadcasts
}

export default function BroadcastManagementPage() {
    const today = getHKTodayString();
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [activeClass, setActiveClass] = useState<string>('');
    const [students, setStudents] = useState<Student[]>([]);

    const [assignments, setAssignments] = useState<Record<string, string>>({});

    // Broadcast specific states
    const [broadcastSettings, setBroadcastSettings] = useState<BroadcastSettings>({ active_options: {}, custom_broadcasts: [] });

    // Custom message states
    const [isCreatingCustom, setIsCreatingCustom] = useState(false);
    const [customMessageText, setCustomMessageText] = useState('');
    const [customSelectedStudents, setCustomSelectedStudents] = useState<Map<string, StudentRef>>(new Map());

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (activeClass) {
            fetchClassData(activeClass);
        }
    }, [activeClass]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            // Fetch classes
            const { data: classData } = await (supabase as any).from('classes').select('name').order('order_index');
            const classes = classData ? classData.map((c: any) => c.name) : [];
            setAvailableClasses(classes);
            if (classes.length > 0) setActiveClass(classes[0]);

            // Fetch students
            const { data: studentData } = await (supabase as any).from('users').select('id, display_name, class').not('class', 'is', null);
            if (studentData) setStudents(studentData);

            // Fetch Settings
            const { data: configData } = await (supabase as any)
                .from('system_config')
                .select('value')
                .eq('key', 'broadcast_v2_settings')
                .maybeSingle();

            if (configData) {
                const parsed = JSON.parse(configData.value);
                // Migrate old Record<string, CustomBroadcast[]> to new CustomBroadcast[] if necessary
                let migratedCustoms: CustomBroadcast[] = [];
                if (parsed.custom_broadcasts && !Array.isArray(parsed.custom_broadcasts)) {
                    Object.entries(parsed.custom_broadcasts).forEach(([cls, broadcasts]: [string, any]) => {
                        broadcasts.forEach((b: any) => {
                            migratedCustoms.push({
                                id: b.id,
                                message: b.message,
                                students: b.students.map((name: string) => ({ name, className: cls })),
                                is_active: (parsed.active_options?.[cls] || []).includes(b.id)
                            });
                        });
                    });
                } else {
                    migratedCustoms = parsed.custom_broadcasts || [];
                }

                setBroadcastSettings({
                    active_options: parsed.active_options || {},
                    custom_broadcasts: migratedCustoms
                });
            }


        } catch (err) {
            console.error('Error fetching initial data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchClassData = async (targetClass: string) => {
        try {
            const { data } = await (supabase as any)
                .from('daily_homework')
                .select('assignments')
                .eq('date', today)
                .eq('class_name', targetClass)
                .maybeSingle();

            if (data) {
                setAssignments(data.assignments);
            } else {
                setAssignments({});
            }
        } catch (err) {
            console.error('Error fetching homework:', err);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save Assignments
            await (supabase as any)
                .from('daily_homework')
                .upsert({
                    date: today,
                    class_name: activeClass,
                    assignments: assignments,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'date,class_name' });

            // Save Broadcast Settings
            await (supabase as any)
                .from('system_config')
                .upsert({
                    key: 'broadcast_v2_settings',
                    value: JSON.stringify(broadcastSettings)
                });

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error('Save failed:', err);
            alert('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleOption = (id: string) => {
        setBroadcastSettings(prev => {
            const activeForClass = prev.active_options[activeClass] || [];
            const newActive = activeForClass.includes(id)
                ? activeForClass.filter(i => i !== id)
                : [...activeForClass, id];
            return { ...prev, active_options: { ...prev.active_options, [activeClass]: newActive } };
        });
    };

    const handleCreateCustomMessage = () => {
        if (!customMessageText.trim()) return;

        const newCustom: CustomBroadcast = {
            id: `custom_${Date.now()}`,
            message: customMessageText.trim(),
            students: Array.from(customSelectedStudents.values()),
            is_active: true // Auto-activate the new message globally
        };

        setBroadcastSettings(prev => ({
            ...prev,
            custom_broadcasts: [...(prev.custom_broadcasts || []), newCustom]
        }));

        setIsCreatingCustom(false);
        setCustomMessageText('');
        setCustomSelectedStudents(new Map());
    };

    const deleteCustomMessage = (id: string) => {
        setBroadcastSettings(prev => ({
            ...prev,
            custom_broadcasts: (prev.custom_broadcasts || []).filter(c => c.id !== id)
        }));
    };

    const toggleCustomMessage = (id: string) => {
        setBroadcastSettings(prev => ({
            ...prev,
            custom_broadcasts: (prev.custom_broadcasts || []).map(c =>
                c.id === id ? { ...c, is_active: !c.is_active } : c
            )
        }));
    };



    const activeOptions = broadcastSettings.active_options[activeClass] || [];
    const customBroadcasts = broadcastSettings.custom_broadcasts || [];

    // Combine all available options for the table
    const tableOptions = [
        {
            id: 'preset_missing_hw',
            type: 'Preset',
            message: 'Track Missing Homework (Today)',
            affected: 'Auto-detected from records',
            isCustom: false,
            isActive: activeOptions.includes('preset_missing_hw'),
            onToggle: () => toggleOption('preset_missing_hw')
        },
        ...customBroadcasts.map(c => ({
            id: c.id,
            type: 'Custom Message',
            message: c.message,
            affected: c.students.length > 0 ? c.students.map(s => s.name).join(', ') : 'All Students (School-wide)',
            isCustom: true,
            isActive: c.is_active,
            onToggle: () => toggleCustomMessage(c.id)
        }))
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <AdminLayout title="Broadcast Management" icon={<Layout className="w-6 h-6" />}>
            <div className="p-6 max-w-7xl mx-auto pb-32">
                <div className="flex items-center justify-end mb-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-sm">
                            <Calendar className="text-slate-400" size={20} />
                            <span className="font-bold text-slate-700">{today}</span>
                        </div>
                    </div>
                </div>

                {/* Class Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
                    {availableClasses.map(c => (
                        <button
                            key={c}
                            onClick={() => setActiveClass(c)}
                            className={`px-8 py-3 rounded-2xl font-black text-sm transition-all whitespace-nowrap shadow-sm
                                ${activeClass === c
                                    ? 'bg-blue-600 text-white shadow-blue-200'
                                    : 'bg-white text-slate-500 hover:bg-slate-50 border-2 border-slate-100 hover:border-blue-200'
                                }`}
                        >
                            Class {c}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left: Homework Assignments Input */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <ListChecks className="text-blue-500" />
                                    Daily Assignments
                                </h2>
                            </div>

                            <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin">
                                {Object.values(SUBJECT_NAMES).map(subject => (
                                    <div key={subject} className="group">
                                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 group-focus-within:text-blue-600 transition-colors">
                                            {subject}
                                        </label>
                                        <textarea
                                            value={assignments[subject] || ''}
                                            onChange={(e) => setAssignments(prev => ({ ...prev, [subject]: e.target.value }))}
                                            placeholder={`Enter ${subject} assignments...`}
                                            rows={2}
                                            className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-3 font-bold text-slate-700 text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Broadcast Options Table & Custom Message */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <Layout className="text-orange-500" />
                                        Broadcast Display Options
                                    </h2>
                                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Select what to show on the live board</p>
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={`px-8 py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase text-xs tracking-widest transition-all shadow-md
                                        ${saveSuccess
                                            ? 'bg-green-500 text-white shadow-green-100'
                                            : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-100 disabled:opacity-50'}`}
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
                                    {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save & Publish'}
                                </button>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                            <th className="p-4 w-16 text-center">Show</th>
                                            <th className="p-4 w-32">Type</th>
                                            <th className="p-4">Message / Option</th>
                                            <th className="p-4 w-1/3">Affected Students</th>
                                            <th className="p-4 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableOptions.map((opt) => (
                                            <tr key={opt.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${opt.isActive ? 'bg-blue-50/30' : ''}`}>
                                                <td className="p-4 text-center">
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); opt.onToggle(); }}
                                                        className={`w-6 h-6 mx-auto rounded-md border-2 flex items-center justify-center cursor-pointer transition-colors
                                                            ${opt.isActive ? 'bg-orange-500 border-orange-500 text-white shadow-sm' : 'bg-white border-slate-300 text-transparent hover:border-orange-300'}`}
                                                    >
                                                        <Check size={14} strokeWidth={4} />
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                                                        ${opt.type === 'Preset' ? 'bg-slate-100 text-slate-500' : opt.type === 'Homework Record' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                                        {opt.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold text-slate-700 text-sm">
                                                    {opt.message}
                                                </td>
                                                <td className="p-4 text-xs font-bold text-slate-500">
                                                    {opt.affected}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {opt.isCustom && (
                                                        <button
                                                            onClick={() => deleteCustomMessage(opt.id)}
                                                            className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Create Custom Message Section */}
                            <div className="p-6 bg-slate-50/50 border-t border-slate-100">
                                {!isCreatingCustom ? (
                                    <button
                                        onClick={() => setIsCreatingCustom(true)}
                                        className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 font-black uppercase tracking-widest text-sm hover:bg-white hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={18} />
                                        Create New Custom Message
                                    </button>
                                ) : (
                                    <div className="bg-white border-2 border-blue-200 rounded-2xl p-6 shadow-lg animate-in fade-in slide-in-from-top-2">
                                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">New Custom Broadcast</h3>

                                        <div className="space-y-4">
                                            <input
                                                type="text"
                                                placeholder="Type your message here..."
                                                value={customMessageText}
                                                onChange={(e) => setCustomMessageText(e.target.value)}
                                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                                autoFocus
                                            />

                                            <div>
                                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                                                    Select Associated Students (From ANY Class)
                                                </label>
                                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 max-h-[250px] overflow-y-auto space-y-4">
                                                    {availableClasses.map(cls => {
                                                        const studentsInClass = students.filter(s => s.class === cls);
                                                        if (studentsInClass.length === 0) return null;
                                                        return (
                                                            <div key={cls}>
                                                                <h4 className="text-xs font-bold text-slate-500 mb-2 border-b border-slate-200 pb-1">Class {cls}</h4>
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                                    {studentsInClass.map(student => (
                                                                        <div
                                                                            key={student.id}
                                                                            onClick={() => {
                                                                                const newMap = new Map(customSelectedStudents);
                                                                                if (newMap.has(student.id)) newMap.delete(student.id);
                                                                                else newMap.set(student.id, { name: student.display_name, className: student.class });
                                                                                setCustomSelectedStudents(newMap);
                                                                            }}
                                                                            className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-colors
                                                                                ${customSelectedStudents.has(student.id) ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-transparent text-slate-600 hover:border-slate-200'}`}
                                                                        >
                                                                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border 
                                                                                ${customSelectedStudents.has(student.id) ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`}>
                                                                                {customSelectedStudents.has(student.id) && <Check size={10} color="white" strokeWidth={4} />}
                                                                            </div>
                                                                            <span className="text-xs font-bold truncate">{student.display_name}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {students.length === 0 && (
                                                        <div className="text-center text-slate-400 text-sm font-bold pt-4">No students found in the school</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                                <button
                                                    onClick={() => setIsCreatingCustom(false)}
                                                    className="px-6 py-2.5 rounded-xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleCreateCustomMessage}
                                                    disabled={!customMessageText.trim()}
                                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
                                                >
                                                    <Plus size={16} />
                                                    Add Option
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
