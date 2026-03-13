import React, { useState, useEffect } from 'react';
import { X, MessageSquare, ListChecks, Send, CheckCircle2, Loader2, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NotificationType } from '@/types/notifications';
import { BROADCAST_SOURCE } from '@/constants/broadcastConfig';

interface NotificationTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationTemplateModal: React.FC<NotificationTemplateModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'templates' | 'presets' | 'publish'>('templates');
    const [activeBroadcasts, setActiveBroadcasts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [newMessage, setNewMessage] = useState<{ title: string, message: string, type: NotificationType }>({ title: '', message: '', type: 'neutral' });
    const [selectedClassesForNew, setSelectedClassesForNew] = useState<string[]>([]);
    const [availableStudents, setAvailableStudents] = useState<any[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

    // Broadcast specific states
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [broadcastSettings, setBroadcastSettings] = useState<{ active_options: Record<string, string[]> }>({ active_options: {} });
    const [publishTemplateId, setPublishTemplateId] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchInitialBroadcastData();
            fetchActiveBroadcasts();
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedClassesForNew.length > 0) {
            fetchStudentsForClasses();
        } else {
            setAvailableStudents([]);
            setSelectedStudentIds([]);
        }
    }, [selectedClassesForNew]);

    const fetchStudentsForClasses = async () => {
        try {
            // Handle 'ALL' case - fetch all students in available classes
            const classesToFetch = selectedClassesForNew.includes('ALL') 
                ? availableClasses 
                : selectedClassesForNew;

            const { data: students, error } = await supabase
                .from('users')
                .select('id, display_name, class')
                .in('class', classesToFetch)
                .order('class')
                .order('display_name');

            if (error) throw error;
            setAvailableStudents(students || []);
        } catch (err) {
            console.error('Error fetching students:', err);
        }
    };

    const fetchInitialBroadcastData = async () => {
        try {
            // Fetch classes
            const { data: classData } = await (supabase as any).from('classes').select('name').order('order_index');
            const classes = classData ? classData.map((c: any) => c.name) : [];
            setAvailableClasses(classes);
            if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);

            // Fetch Settings
            const { data: configData } = await (supabase as any)
                .from('system_config')
                .select('value')
                .eq('key', 'broadcast_v2_settings')
                .maybeSingle();

            if (configData) {
                const parsed = typeof configData.value === 'string' ? JSON.parse(configData.value) : configData.value;
                setBroadcastSettings({
                    active_options: parsed.active_options || {},
                });
            }
        } catch (err) {
            console.error('Error fetching broadcast data:', err);
        }
    };

    const handleSaveBroadcastSettings = async (settings: { active_options: Record<string, string[]> }) => {
        setIsSaving(true);
        try {
            // Fetch current settings first to avoid overwriting other keys (like active_announcements)
            const { data: currentConfig } = await (supabase as any)
                .from('system_config')
                .select('value')
                .eq('key', 'broadcast_v2_settings')
                .maybeSingle();
            
            let fullSettings = currentConfig ? (typeof currentConfig.value === 'string' ? JSON.parse(currentConfig.value) : currentConfig.value) : {};
            fullSettings.active_options = settings.active_options;

            await (supabase as any)
                .from('system_config')
                .upsert({
                    key: 'broadcast_v2_settings',
                    value: JSON.stringify(fullSettings)
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

    const togglePreset = (presetId: string) => {
        if (!selectedClass) return;
        const currentOptions = broadcastSettings.active_options[selectedClass] || [];
        const newOptions = currentOptions.includes(presetId)
            ? currentOptions.filter((id: string) => id !== presetId)
            : [...currentOptions, presetId];
        
        const newSettings = {
            ...broadcastSettings,
            active_options: { ...broadcastSettings.active_options, [selectedClass]: newOptions }
        };
        setBroadcastSettings(newSettings);
        handleSaveBroadcastSettings(newSettings);
    };

    const fetchActiveBroadcasts = async () => {
        setIsLoading(true);
        try {
            // Fetch all records with a limit
            const { data: records, error } = await supabase
                .from('student_records')
                .select('id, type, message, created_at, student_id, record_type, target_classes, student:student_id(display_name, class)')
                .eq('record_type', 'broadcast')
                .eq('source', BROADCAST_SOURCE)
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) throw error;
            console.log('DIAGNOSTIC: NotificationTemplateModal - Broadcast records length:', records?.length || 0);

            // Group by message and timestamp (roughly same broadcast)
            // A more robust way would be a batch ID, but for now we'll cluster by message content
            const groups: Record<string, any> = {};
            
            (records || []).forEach((r: any) => {
                // Skip specific items (starts with 功課:) if any
                if (r.message && r.message.startsWith('功課:')) return;

                const key = r.message;
                if (!groups[key]) {
                    // Strip metadata suffixes for display in the management list
                    const displayMessage = (r.message || '').split(' ||{')[0].split(' @@{')[0];
                    groups[key] = {
                        message: displayMessage,
                        rawMessage: r.message,
                        type: r.type,
                        created_at: r.created_at,
                        classes: new Set(r.target_classes || []),
                        studentIds: [],
                        count: 0
                    };
                }
                if (r.student?.class) {
                    groups[key].classes.add(r.student.class);
                }
                groups[key].studentIds.push(r.id);
                groups[key].count++;
            });

            setActiveBroadcasts(Object.values(groups).map(g => ({
                ...g,
                classes: Array.from(g.classes as Set<string>)
            })));
        } catch (err) {
            console.error('Error fetching active broadcasts:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnpublish = async (ids: string[]) => {
        if (!confirm('Are you sure you want to remove this message from all targeted student boards?')) return;
        
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('student_records')
                .delete()
                .in('id', ids);

            if (error) throw error;
            fetchActiveBroadcasts();
        } catch (err) {
            console.error('Unpublish failed:', err);
            alert('Failed to unpublish message');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDirectBroadcast = async () => {
        if (!newMessage.message || selectedClassesForNew.length === 0) {
            alert('Please enter a message and select at least one class.');
            return;
        }

        setIsSaving(true);
        try {
            // 1. Get ALL students in the selected classes (Broadcast means everyone)
            const { data: allStudents, error: fetchError } = await (supabase as any)
                .from('users')
                .select('id, display_name, class')
                .in('class', selectedClassesForNew);

            if (fetchError) throw fetchError;
            if (!allStudents || allStudents.length === 0) {
                alert(`No students found in the selected classes: ${selectedClassesForNew.join(', ')}`);
                return;
            }

            const primaryClassId = selectedClassesForNew[0] || 'ALL';
            const isTargeted = selectedStudentIds.length > 0;
            const fullMessage = `${newMessage.title ? `[${newMessage.title}] ` : ''}${newMessage.message}`;
            const groupId = crypto.randomUUID();
            const finalTargetClasses = selectedClassesForNew.includes('ALL') ? ['ALL'] : selectedClassesForNew;

            if (!isTargeted) {
                const result = await supabase.rpc('insert_audited_student_record', {
                    p_student_id: null,
                    p_message: fullMessage,
                    p_type: newMessage.type,
                    p_class_id: primaryClassId,
                    p_record_type: 'broadcast',
                    p_source: BROADCAST_SOURCE,
                    p_target_classes: finalTargetClasses,
                    p_broadcast_group_id: groupId,
                    p_reason: 'Broadcast Management'
                });
                if (result.error) throw result.error;
            } else {
                for (const sid of selectedStudentIds) {
                    const result = await supabase.rpc('insert_audited_student_record', {
                        p_student_id: sid,
                        p_message: fullMessage,
                        p_type: newMessage.type,
                        p_class_id: primaryClassId,
                        p_record_type: 'broadcast',
                        p_source: BROADCAST_SOURCE,
                        p_target_classes: finalTargetClasses,
                        p_broadcast_group_id: groupId,
                        p_reason: 'Targeted Broadcast'
                    });
                    if (result.error) throw result.error;
                }
            }

            setSaveSuccess(true);
            setNewMessage({ title: '', message: '', type: 'neutral' });
            setSelectedClassesForNew([]);
            setSelectedStudentIds([]);
            fetchActiveBroadcasts();
            setTimeout(() => setSaveSuccess(false), 3000);
            alert(`Message broadcast successfully to ${selectedClassesForNew.join(', ')}.`);
        } catch (err) {
            console.error('Broadcast failed:', err);
            alert('Failed to broadcast message');
        } finally {
            setIsSaving(false);
        }
    };


    // Simple update logic (if needed, or just delete/re-create for simplicity in this version)
    // For now, let's keep it simple: Add and Delete. Edit can come later if requested.

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[hsl(var(--card))] w-full max-w-2xl rounded-xl border border-[hsl(var(--border))] shadow-2xl flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[hsl(var(--border))] bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black flex items-center gap-2 text-slate-800">
                            <MessageSquare className="w-6 h-6 text-blue-600" />
                            Broadcast & Notifications
                        </h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Manage messages and live board settings</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 shadow-sm border border-slate-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[hsl(var(--border))] bg-white sticky top-0 z-10">
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
                            ${activeTab === 'templates' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <MessageSquare size={16} />
                        Messages
                    </button>
                    <button
                        onClick={() => setActiveTab('presets')}
                        className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
                            ${activeTab === 'presets' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/30' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <ListChecks size={16} />
                        Presets
                    </button>
                    <button
                        onClick={() => setActiveTab('publish')}
                        className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2
                            ${activeTab === 'publish' ? 'text-green-600 border-b-2 border-green-600 bg-green-50/30' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Send size={16} />
                        Publish Now
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'templates' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Create New Message Section */}
                            <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 space-y-4">
                                <div className="flex flex-col gap-4 mb-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-500">Create New Message</h3>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase">Target Classes:</label>
                                            <div className="flex flex-wrap gap-1">
                                                <button
                                                    onClick={() => {
                                                        setSelectedClassesForNew(prev => 
                                                            prev.includes('ALL') ? [] : ['ALL', ...availableClasses]
                                                        );
                                                    }}
                                                    className={`px-2 py-1 rounded text-[10px] font-black transition-all border flex items-center gap-1 ${
                                                        selectedClassesForNew.includes('ALL')
                                                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-800'
                                                    }`}
                                                >
                                                    <Globe size={10} />
                                                    ALL
                                                </button>
                                                {availableClasses.map((c: string) => (
                                                    <button
                                                        key={c}
                                                        onClick={() => {
                                                            setSelectedClassesForNew((prev: string[]) => {
                                                                let next = prev.filter(v => v !== 'ALL');
                                                                if (next.includes(c)) {
                                                                    next = next.filter((cls: string) => cls !== c);
                                                                } else {
                                                                    next = [...next, c];
                                                                }
                                                                return next;
                                                            });
                                                        }}
                                                        className={`px-2 py-1 rounded text-[10px] font-black transition-all border ${
                                                            selectedClassesForNew.includes(c) && !selectedClassesForNew.includes('ALL')
                                                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                                : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'
                                                        }`}
                                                    >
                                                        {c}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {availableStudents.length > 0 && (
                                        <div className="bg-white p-3 rounded-xl border-2 border-slate-100 flex flex-col gap-2 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
                                                    Pick Students (Optional)
                                                    <span className="text-[9px] font-bold text-slate-300 normal-case">/ defaults to all if none selected</span>
                                                </label>
                                                {selectedStudentIds.length > 0 && (
                                                    <button 
                                                        onClick={() => setSelectedStudentIds([])}
                                                        className="text-[9px] font-black text-blue-600 uppercase hover:underline"
                                                    >
                                                        Clear Selection ({selectedStudentIds.length})
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                                                {availableStudents.map((s: any) => {
                                                    const isSelected = selectedStudentIds.includes(s.id);
                                                    return (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => {
                                                                setSelectedStudentIds(prev => 
                                                                    prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                                                );
                                                            }}
                                                            className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all border flex items-center gap-1
                                                                ${isSelected 
                                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                                                                    : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-blue-200 hover:bg-blue-50/50'}`}
                                                        >
                                                            <span className={`text-[8px] font-black ${isSelected ? 'text-blue-100' : 'opacity-40'}`}>{s.class}</span>
                                                            {s.display_name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Title (Optional context)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g., Dictation"
                                            value={newMessage.title}
                                            onChange={e => setNewMessage({ ...newMessage, title: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-slate-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Type/Color</label>
                                        <select
                                            value={newMessage.type}
                                            onChange={e => setNewMessage({ ...newMessage, type: e.target.value as NotificationType })}
                                            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-slate-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 appearance-none"
                                        >
                                            <option value="positive">Positive (Green)</option>
                                            <option value="neutral">Neutral (Blue)</option>
                                            <option value="negative">Negative (Red/Orange)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Message Content</label>
                                    <textarea
                                        placeholder="Type the announcement here..."
                                        value={newMessage.message}
                                        onChange={e => setNewMessage({ ...newMessage, message: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-white border-2 border-slate-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 min-h-[100px]"
                                    />
                                    
                                    {selectedStudentIds.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-100">
                                            {selectedStudentIds.map(id => {
                                                const student = availableStudents.find(s => s.id === id);
                                                if (!student) return null;
                                                return (
                                                    <div 
                                                        key={id}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg shadow-sm animate-in zoom-in duration-200"
                                                    >
                                                        <span className="text-[10px] font-black uppercase opacity-70">{student.class}</span>
                                                        <span className="text-[11px] font-black">{student.display_name}</span>
                                                        <button 
                                                            onClick={() => setSelectedStudentIds(prev => prev.filter(i => i !== id))}
                                                            className="p-0.5 hover:bg-white/20 rounded-full transition-all"
                                                        >
                                                            <X size={10} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleDirectBroadcast}
                                        disabled={!newMessage.message || selectedClassesForNew.length === 0 || isSaving}
                                        className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100"
                                    >
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Broadcast to everyone in {selectedClassesForNew.length} Classes
                                    </button>
                                </div>
                            </div>

                            {/* List Section - Messages on Board */}
                            <div className="space-y-4">
                                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-500">All Broadcast Messages</h3>
                                {isLoading ? (
                                    <div className="text-center py-12 flex flex-col items-center gap-3">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                        <p className="text-xs font-bold text-slate-400">Fetching live messages...</p>
                                    </div>
                                ) : activeBroadcasts.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl italic">
                                        No active messages found.
                                    </div>
                                ) : (
                                    <div className="grid gap-4">
                                        {activeBroadcasts.map((broadcast: any, idx: number) => (
                                            <div key={idx} className="flex items-start justify-between p-5 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-md transition-all group">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`w-2.5 h-2.5 rounded-full ${broadcast.type === 'positive' ? 'bg-green-500' :
                                                                broadcast.type === 'negative' ? 'bg-red-500' : 'bg-blue-500'
                                                            }`} />
                                                        <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(broadcast.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <div className="flex gap-1">
                                                            {broadcast.classes.map((c: string) => (
                                                                <span key={c} className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0.5 rounded font-black border border-slate-200">{c}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-700 leading-relaxed">{broadcast.message}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleUnpublish(broadcast.studentIds)}
                                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all ml-4 flex items-center gap-1"
                                                    title="Unpublish"
                                                >
                                                    <X className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase">Unpublish</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'presets' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-orange-50/50 p-6 rounded-2xl border-2 border-orange-100">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">Class Presets</h3>
                                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Toggle system boards for the live display</p>
                                    </div>
                                    <select
                                        value={selectedClass}
                                        onChange={e => setSelectedClass(e.target.value)}
                                        className="bg-white border-2 border-orange-100 rounded-xl px-4 py-2 font-black text-xs uppercase tracking-widest text-slate-700 outline-none focus:border-orange-400"
                                    >
                                        {availableClasses.map((c: string) => (
                                            <option key={c} value={c}>Class {c}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    {[
                                        { id: 'preset_missing_hw', title: 'Missing Homework Board', description: 'Shows students who have not completed homework today.' }
                                    ].map(preset => {
                                        const isActive = (broadcastSettings.active_options[selectedClass] || []).includes(preset.id);
                                        return (
                                            <div 
                                                key={preset.id}
                                                onClick={() => togglePreset(preset.id)}
                                                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group
                                                    ${isActive ? 'bg-white border-orange-500 shadow-md shadow-orange-100' : 'bg-white/50 border-slate-100 opacity-60 hover:opacity-100'}`}
                                            >
                                                <div className="flex-1">
                                                    <h4 className={`font-black tracking-tight ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>{preset.title}</h4>
                                                    <p className="text-xs font-medium text-slate-400 mt-0.5">{preset.description}</p>
                                                </div>
                                                <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${isActive ? 'bg-orange-500' : 'bg-slate-200'}`}>
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isActive ? 'left-7' : 'left-1'}`} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                <div className="mt-8 pt-6 border-t border-orange-100 flex items-center justify-between">
                                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest italic">
                                        Changes are saved automatically and reflect instantly on the board.
                                    </p>
                                    {isSaving && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
                                    {saveSuccess && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'publish' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-green-50/50 p-6 rounded-2xl border-2 border-green-100 space-y-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Globe className="w-5 h-5 text-green-600" />
                                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">Global Broadcast</h3>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Send a pre-formatted template to all students in a class.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Target Class</label>
                                        <select
                                            value={selectedClass}
                                            onChange={e => setSelectedClass(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-green-100 focus:border-green-500 outline-none transition-all font-black text-xs uppercase tracking-widest text-slate-700"
                                        >
                                            {availableClasses.map((c: string) => (
                                                <option key={c} value={c}>Class {c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Select Message from List</label>
                                        <select
                                            value={publishTemplateId}
                                            onChange={e => setPublishTemplateId(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-green-100 focus:border-green-500 outline-none transition-all font-bold text-slate-700"
                                        >
                                            <option value="">No templates available...</option>
                                        </select>
                                        <p className="text-[9px] text-slate-400 font-bold ml-1 italic">(Templates are deprecated. Use the Messages tab for direct broadcast)</p>
                                    </div>
                                </div>

                                <button
                                    disabled={true}
                                    className="w-full py-4 bg-slate-200 text-slate-400 rounded-2xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 cursor-not-allowed"
                                >
                                    <Send size={20} />
                                    Legacy Publish (Disabled)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
