import { useState, useEffect } from 'react';
import { Save, ListChecks, Calendar, CheckCircle2, Loader2, Layout, Plus, Check, Trash2, Zap, Pencil, Send, X } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { getHKTodayString } from '@/utils/dateUtils';

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
    is_active: boolean; // Used historically, maybe obsolete soon, kept for migration
}

interface ActiveAnnouncement {
    id: string;
    templateId: string;
    topic: string;
    messageTemplate: string;
    targetClass: string;
    targetStudents: StudentRef[]; // empty means all in class
    remarks?: string;
    createdAt: string;
}

interface BroadcastSettings {
    active_options: Record<string, string[]>; // class -> array of active IDs/messages (for presets)
    custom_broadcasts: CustomBroadcast[]; // global array of custom broadcasts (templates)
    active_announcements?: ActiveAnnouncement[]; // published instances
}

export default function BroadcastManagementPage() {
    const today = getHKTodayString();
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [activeClass, setActiveClass] = useState<string>('');
    const [students, setStudents] = useState<Student[]>([]);
    const [activeTab, setActiveTab] = useState<'settings' | 'current'>('settings');

    // Broadcast specific states
    const [broadcastSettings, setBroadcastSettings] = useState<BroadcastSettings>({ active_options: {}, custom_broadcasts: [] });

    // Custom message states (Templates)
    const [isCreatingCustom, setIsCreatingCustom] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [customMessageText, setCustomMessageText] = useState('');

    // Publish Modal states
    const [publishModalOpen, setPublishModalOpen] = useState(false);
    const [publishTemplate, setPublishTemplate] = useState<CustomBroadcast | null>(null);
    const [publishTopic, setPublishTopic] = useState('');
    const [publishTargetClass, setPublishTargetClass] = useState('');
    const [publishTargetStudents, setPublishTargetStudents] = useState<Map<string, StudentRef>>(new Map());
    const [publishRemarks, setPublishRemarks] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (activeClass) {
            // Fetch anything specific to the class if needed
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
                    custom_broadcasts: migratedCustoms,
                    active_announcements: parsed.active_announcements || []
                });
            }


        } catch (err) {
            console.error('Error fetching initial data:', err);
        } finally {
            setIsLoading(false);
        }
    };


    const saveSettingsToDB = async (settings: BroadcastSettings) => {
        setIsSaving(true);
        try {
            await (supabase as any)
                .from('system_config')
                .upsert({
                    key: 'broadcast_v2_settings',
                    value: JSON.stringify(settings)
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

    const handleSave = async () => {
        await saveSettingsToDB(broadcastSettings);
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

    const startEditing = (msg: CustomBroadcast) => {
        setEditingMessageId(msg.id);
        setCustomMessageText(msg.message);
        setIsCreatingCustom(true);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const cancelEditing = () => {
        setEditingMessageId(null);
        setCustomMessageText('');
        setIsCreatingCustom(false);
    };

    const handleCreateCustomMessage = () => {
        if (!customMessageText.trim()) return;

        const newCustom: CustomBroadcast = {
            id: editingMessageId || `custom_${Date.now()}`,
            message: customMessageText.trim(),
            students: [], // Templates are now message-only
            is_active: true
        };

        setBroadcastSettings(prev => {
            const existing = prev.custom_broadcasts || [];
            if (editingMessageId) {
                return {
                    ...prev,
                    custom_broadcasts: existing.map(c => c.id === editingMessageId ? newCustom : c)
                };
            }
            return {
                ...prev,
                custom_broadcasts: [...existing, newCustom]
            };
        });

        cancelEditing();
    };

    const openPublishModal = (template: CustomBroadcast) => {
        setPublishTemplate(template);
        setPublishTopic('');
        setPublishTargetClass(availableClasses[0] || '');

        // Do not pre-select students for announcements
        setPublishTargetStudents(new Map());
        setPublishRemarks('');
        setPublishModalOpen(true);
    };

    const closePublishModal = () => {
        setPublishModalOpen(false);
        setPublishTemplate(null);
        setPublishTopic('');
        setPublishTargetClass('');
        setPublishTargetStudents(new Map());
        setPublishRemarks('');
    };

    const handlePublish = () => {
        if (!publishTemplate || !publishTargetClass) return;

        const newAnnouncement: ActiveAnnouncement = {
            id: `announce_${Date.now()}`,
            templateId: publishTemplate.id,
            topic: publishTopic.trim(), // Can be empty now
            messageTemplate: publishTemplate.message,
            targetClass: publishTargetClass,
            targetStudents: Array.from(publishTargetStudents.values()),
            remarks: publishRemarks.trim() || undefined,
            createdAt: new Date().toISOString()
        };

        const newSettings = {
            ...broadcastSettings,
            active_announcements: [newAnnouncement, ...(broadcastSettings.active_announcements || [])]
        };

        setBroadcastSettings(newSettings);
        saveSettingsToDB(newSettings);

        closePublishModal();
    };

    const deleteCustomMessage = (id: string) => {
        setBroadcastSettings(prev => ({
            ...prev,
            custom_broadcasts: (prev.custom_broadcasts || []).filter(c => c.id !== id)
        }));
    };

    // Toggling template active state might be obsolete now in favor of instances, but keeping for compatibility
    const toggleCustomMessage = (id: string) => {
        setBroadcastSettings(prev => ({
            ...prev,
            custom_broadcasts: (prev.custom_broadcasts || []).map(c =>
                c.id === id ? { ...c, is_active: !c.is_active } : c
            )
        }));
    };

    const unpublishAnnouncement = (id: string) => {
        const newSettings = {
            ...broadcastSettings,
            active_announcements: (broadcastSettings.active_announcements || []).filter(a => a.id !== id)
        };
        setBroadcastSettings(newSettings);
        saveSettingsToDB(newSettings);
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
            affected: 'Select students on Publish',
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
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-sm w-fit">
                        <Calendar className="text-slate-400" size={20} />
                        <span className="font-bold text-slate-700">{today}</span>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all
                                ${activeTab === 'settings' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Display Options
                        </button>
                        <button
                            onClick={() => setActiveTab('current')}
                            className={`px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all
                                ${activeTab === 'current' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Current Broadcast
                        </button>
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

                {/* Class Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
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

                {activeTab === 'settings' ? (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <ListChecks className="text-orange-500" />
                                Broadcast Display Options
                            </h2>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Select what to show for Class {activeClass}</p>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-slate-50 z-10">
                                    <tr className="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <th className="p-4 w-32">Type</th>
                                        <th className="p-4">Message Template / Option</th>
                                        <th className="p-4 w-1/3">Target Students</th>
                                        <th className="p-4 w-32 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableOptions.map((opt) => (
                                        <tr key={opt.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${opt.isActive && !opt.isCustom ? 'bg-blue-50/30' : ''}`}>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {!opt.isCustom && (
                                                        <div
                                                            onClick={(e) => { e.stopPropagation(); opt.onToggle(); }}
                                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-colors shrink-0
                                                                ${opt.isActive ? 'bg-orange-500 border-orange-500 text-white shadow-sm' : 'bg-white border-slate-300 text-transparent hover:border-orange-300'}`}
                                                        >
                                                            <Check size={12} strokeWidth={4} />
                                                        </div>
                                                    )}
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap
                                                        ${opt.type === 'Preset' ? 'bg-slate-100 text-slate-500' : 'bg-purple-100 text-purple-600'}`}>
                                                        {opt.type === 'Custom Message' ? 'Template' : opt.type}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 font-bold text-slate-700 text-sm">
                                                {opt.message}
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-500">
                                                {opt.affected}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    {opt.isCustom && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const msg = broadcastSettings.custom_broadcasts.find(c => c.id === opt.id);
                                                                if (msg) openPublishModal(msg);
                                                            }}
                                                            className="text-green-500 hover:text-green-700 hover:bg-green-50 p-2 rounded-lg transition-colors flex items-center gap-1 font-bold text-xs"
                                                            title="Publish Announcement"
                                                        >
                                                            <Send size={14} className="-mt-0.5" />
                                                            Publish
                                                        </button>
                                                    )}
                                                    {opt.isCustom && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const msg = broadcastSettings.custom_broadcasts.find(c => c.id === opt.id);
                                                                if (msg) startEditing(msg);
                                                            }}
                                                            className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                                            title="Edit Message"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                    )}
                                                    {opt.isCustom && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteCustomMessage(opt.id);
                                                            }}
                                                            className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                                                            title="Delete Template"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
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
                                    onClick={() => {
                                        cancelEditing();
                                        setIsCreatingCustom(true);
                                    }}
                                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 font-black uppercase tracking-widest text-sm hover:bg-white hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} />
                                    Create New Custom Message
                                </button>
                            ) : (
                                <div className="bg-white border-2 border-blue-200 rounded-2xl p-6 shadow-lg animate-in fade-in slide-in-from-top-2">
                                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">
                                        {editingMessageId ? 'Edit Custom Broadcast' : 'New Custom Broadcast'}
                                    </h3>

                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            placeholder="Type your message here..."
                                            value={customMessageText}
                                            onChange={(e) => setCustomMessageText(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                            autoFocus
                                        />

                                        {/* Student selection removed from template creation */}

                                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                            <button
                                                onClick={cancelEditing}
                                                className="px-6 py-2.5 rounded-xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleCreateCustomMessage}
                                                disabled={!customMessageText.trim()}
                                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
                                            >
                                                {editingMessageId ? <Save size={16} /> : <Plus size={16} />}
                                                {editingMessageId ? 'Update Option' : 'Add Option'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Publish Modal Overlay */}
                        {publishModalOpen && publishTemplate && (
                            <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                            <Send className="text-blue-500" size={24} />
                                            Publish Announcement
                                        </h3>
                                        <button onClick={closePublishModal} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="p-6 overflow-y-auto flex-1 space-y-6">
                                        {/* Template Preview */}
                                        <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4">
                                            <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-1">Message Template</p>
                                            <p className="font-bold text-slate-700">{publishTemplate.message}</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Assignment Topic */}
                                            <div className="space-y-2">
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                                    Topic (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g., Dictation Correction"
                                                    value={publishTopic}
                                                    onChange={(e) => setPublishTopic(e.target.value)}
                                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                                    autoFocus
                                                />
                                            </div>

                                            {/* Target Class */}
                                            <div className="space-y-2">
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                                    Target Class (Required)
                                                </label>
                                                <select
                                                    value={publishTargetClass}
                                                    onChange={(e) => {
                                                        setPublishTargetClass(e.target.value);
                                                        setPublishTargetStudents(new Map()); // Reset students when class changes
                                                    }}
                                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all appearance-none"
                                                >
                                                    <option value="" disabled>Select a class</option>
                                                    {availableClasses.map(c => (
                                                        <option key={c} value={c}>Class {c}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Remarks */}
                                        <div className="space-y-2">
                                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                                                <span>Remarks (Optional)</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g., Bring your handbook"
                                                value={publishRemarks}
                                                onChange={(e) => setPublishRemarks(e.target.value)}
                                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                            />
                                        </div>

                                        {/* Target Students */}
                                        {publishTargetClass && (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest flex items-center justify-between pointer-events-none">
                                                    <span>Target Students (Optional)</span>
                                                    <span className="normal-case tracking-normal opacity-50">Default: All {publishTargetClass}</span>
                                                </label>
                                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 max-h-[150px] overflow-y-auto">
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {students.filter(s => s.class === publishTargetClass).map(student => (
                                                            <div
                                                                key={student.id}
                                                                onClick={() => {
                                                                    const newMap = new Map(publishTargetStudents);
                                                                    if (newMap.has(student.id)) newMap.delete(student.id);
                                                                    else newMap.set(student.id, { name: student.display_name, className: student.class });
                                                                    setPublishTargetStudents(newMap);
                                                                }}
                                                                className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-colors
                                                                    ${publishTargetStudents.has(student.id) ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-transparent text-slate-600 hover:border-slate-200'}`}
                                                            >
                                                                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border 
                                                                    ${publishTargetStudents.has(student.id) ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`}>
                                                                    {publishTargetStudents.has(student.id) && <Check size={10} color="white" strokeWidth={4} />}
                                                                </div>
                                                                <span className="text-xs font-bold truncate">{student.display_name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                                        <button
                                            onClick={closePublishModal}
                                            className="px-6 py-3 rounded-xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handlePublish}
                                            disabled={!publishTargetClass}
                                            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
                                        >
                                            <Send size={16} />
                                            Publish Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <CurrentBroadcastPreview
                            className={activeClass}
                            settings={broadcastSettings}
                            onUnpublish={unpublishAnnouncement}
                        />
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function CurrentBroadcastPreview({ className, settings, onUnpublish }: {
    className: string,
    settings: BroadcastSettings,
    onUnpublish: (id: string) => void
}) {
    const activeOptions = settings.active_options[className] || [];
    const activeAnnouncements = settings.active_announcements || [];

    const classAnnouncements = activeAnnouncements.filter(a => a.targetClass === className);

    const hasData = activeOptions.includes('preset_missing_hw') || classAnnouncements.length > 0;

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Zap className="text-blue-500" size={20} />
                        Active Published Items
                    </h2>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Currently live for Class {className}</p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/80 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th className="p-4 w-32">Type</th>
                            <th className="p-4 w-1/4">Topic</th>
                            <th className="p-4">Message Details</th>
                            <th className="p-4 w-1/4">Target Students</th>
                            <th className="p-4 w-24 text-center">Status</th>
                            <th className="p-4 w-16 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeOptions.includes('preset_missing_hw') && (
                            <tr className="border-b border-slate-50 bg-orange-50/10">
                                <td className="p-4">
                                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-600">
                                        Preset
                                    </span>
                                </td>
                                <td className="p-4 font-bold text-slate-700 text-sm">
                                    Homework Check (Missing Items)
                                </td>
                                <td className="p-4 text-xs font-bold text-slate-500 italic">
                                    Auto-generated list
                                </td>
                                <td className="p-4 text-xs font-bold text-slate-500 italic">
                                    Auto-detect
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-green-500 font-black text-[10px] uppercase tracking-widest">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                        Live
                                    </div>
                                </td>
                                <td className="p-4"></td>
                            </tr>
                        )}

                        {classAnnouncements.map((ann) => (
                            <tr key={ann.id} className="border-b border-slate-50">
                                <td className="p-4">
                                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-600">
                                        Announcement
                                    </span>
                                </td>
                                <td className="p-4 font-bold text-slate-700 text-sm">
                                    {ann.topic}
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-bold text-slate-700">{ann.messageTemplate}</span>
                                        {ann.remarks && (
                                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md w-fit">
                                                Note: {ann.remarks}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-xs font-bold text-slate-500">
                                    {ann.targetStudents.length === 0
                                        ? `All Class ${className}`
                                        : ann.targetStudents.map(s => s.name).join(', ')}
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-green-500 font-black text-[10px] uppercase tracking-widest">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                        Live
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center justify-end">
                                        <button
                                            onClick={() => onUnpublish(ann.id)}
                                            className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                                            title="Unpublish"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {!hasData && (
                            <tr>
                                <td colSpan={4} className="p-20 text-center text-slate-400">
                                    <div className="flex flex-col items-center justify-center opacity-30">
                                        <Layout size={48} className="mb-4" />
                                        <p className="text-lg font-black uppercase italic tracking-widest">No Active Messages</p>
                                        <p className="text-xs font-bold mt-2">Publish options in the Display Options tab to see them here.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Snapshot of current broadcast state</span>
                <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                </div>
            </div>
        </div>
    );
}
