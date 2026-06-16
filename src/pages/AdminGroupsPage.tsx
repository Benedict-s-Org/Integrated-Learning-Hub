import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Layers, Plus, Pencil, Trash2, Save, X, Users } from 'lucide-react';
import { GroupMemberModal } from '@/components/admin/GroupMemberModal';

interface GroupItem {
    id: string;
    name: string;
}

export function AdminGroupsPage() {
    const [classes, setClasses] = useState<GroupItem[]>([]);
    const [activities, setActivities] = useState<GroupItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Edit states for classes
    const [editingClassId, setEditingClassId] = useState<string | null>(null);
    const [editClassName, setEditClassName] = useState("");
    const [newClassName, setNewClassName] = useState("");

    // Edit states for activities
    const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
    const [editActivityName, setEditActivityName] = useState("");
    const [newActivityName, setNewActivityName] = useState("");

    // Duty PIN Management
    const [selectedClassForPin, setSelectedClassForPin] = useState<string>('');
    const [newDutyPin, setNewDutyPin] = useState("");
    const [isSettingPin, setIsSettingPin] = useState(false);

    // Member Management Modal
    const [selectedActivityForMembers, setSelectedActivityForMembers] = useState<string | null>(null);

    // Morning Duty Settings
    const [mdEnabled, setMdEnabled] = useState(false);
    const [mdAlarmUrl, setMdAlarmUrl] = useState("");
    const [mdTimes, setMdTimes] = useState<any>({});
    const [mdMessages, setMdMessages] = useState<any>({});
    const [mdWeekdays, setMdWeekdays] = useState<number[]>([1,2,3,4,5]);
    const [mdSilentRecess, setMdSilentRecess] = useState(false);
    const [isTestPlaying, setIsTestPlaying] = useState(false);
    const [testPlayed, setTestPlayed] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<{name: string, url: string}[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (selectedClassForPin) {
            const fetchSettings = async () => {
                const { data, error } = await (supabase as any).from('morning_duty_settings').select('*').eq('class', selectedClassForPin).maybeSingle();
                if (data) {
                    setMdEnabled(data.enabled);
                    setMdAlarmUrl(data.alarm_url || "");
                    setMdTimes(data.times || {});
                    setMdMessages(data.messages || {});
                    setMdWeekdays(data.weekdays || [1,2,3,4,5]);
                    setMdSilentRecess(data.silent_recess || false);
                } else {
                    setMdEnabled(false);
                    setMdAlarmUrl("");
                    setMdTimes({});
                    setMdMessages({});
                    setMdWeekdays([1,2,3,4,5]);
                    setMdSilentRecess(false);
                }
                setTestPlayed(false);
            };
            fetchSettings();
        }
    }, [selectedClassForPin]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: classesData } = await (supabase as any).from('classes').select('*').order('order_index');
            const { data: activitiesData } = await (supabase as any).from('activities').select('*').order('order_index');

            if (classesData) setClasses(classesData as GroupItem[]);
            if (activitiesData) setActivities(activitiesData as GroupItem[]);
        } catch (err) {
            console.error('Error fetching groups:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFiles = async () => {
        try {
            const { data, error } = await supabase.storage.from('morning_duty_assets').list('morning_duties');
            if (data) {
                const files = data.filter(f => f.name !== '.emptyFolderPlaceholder').map(f => {
                    const { data: { publicUrl } } = supabase.storage.from('morning_duty_assets').getPublicUrl(`morning_duties/${f.name}`);
                    return { name: f.name, url: publicUrl };
                });
                setUploadedFiles(files);
            }
        } catch (err) {
            console.error("Error fetching files:", err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchFiles();
    }, []);

    // Handlers for Classes
    const handleAddClass = async () => {
        if (!newClassName.trim()) return;
        try {
            const { error } = await (supabase as any).from('classes').insert({ name: newClassName.trim() });
            if (error) throw error;
            setNewClassName("");
            fetchData();
        } catch (err: any) {
            alert(`Error adding class: ${err.message}`);
        }
    };

    const handleUpdateClass = async (id: string) => {
        if (!editClassName.trim()) return;
        try {
            const { error } = await (supabase as any).from('classes').update({ name: editClassName.trim() }).eq('id', id);
            if (error) throw error;
            setEditingClassId(null);
            fetchData();
        } catch (err: any) {
            alert(`Error updating class: ${err.message}`);
        }
    };

    const handleDeleteClass = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete class "${name}"?`)) return;
        try {
            const { error } = await (supabase as any).from('classes').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            alert(`Error deleting class: ${err.message}`);
        }
    };

    // Handlers for Activities
    const handleAddActivity = async () => {
        if (!newActivityName.trim()) return;
        try {
            const { error } = await (supabase as any).from('activities').insert({ name: newActivityName.trim() });
            if (error) throw error;
            setNewActivityName("");
            fetchData();
        } catch (err: any) {
            alert(`Error adding activity: ${err.message}`);
        }
    };

    const handleUpdateActivity = async (id: string) => {
        if (!editActivityName.trim()) return;
        try {
            const { error } = await (supabase as any).from('activities').update({ name: editActivityName.trim() }).eq('id', id);
            if (error) throw error;
            setEditingActivityId(null);
            fetchData();
        } catch (err: any) {
            alert(`Error updating activity: ${err.message}`);
        }
    };

    const handleDeleteActivity = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete activity "${name}"?`)) return;
        try {
            const { error } = await (supabase as any).from('activities').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            alert(`Error deleting activity: ${err.message}`);
        }
    };

    const handleAlarmUrlChange = (url: string) => {
        let finalUrl = url.trim();
        const pathMatch = finalUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const idMatch = finalUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        
        if (pathMatch && pathMatch[1]) {
            finalUrl = `https://drive.google.com/uc?export=download&id=${pathMatch[1]}`;
        } else if (idMatch && idMatch[1]) {
            finalUrl = `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
        }
        setMdAlarmUrl(finalUrl);
        setTestPlayed(false);
    };

    const handleTestPlay = () => {
        if (!mdAlarmUrl) return;
        if (!audioRef.current) {
            audioRef.current = new Audio(mdAlarmUrl);
        } else {
            audioRef.current.src = mdAlarmUrl;
        }
        
        audioRef.current.play().then(() => {
            setTestPlayed(true);
            setIsTestPlaying(true);
            audioRef.current!.onended = () => setIsTestPlaying(false);
            audioRef.current!.onerror = () => {
                 alert('Failed to play audio. Please check the URL/permissions.');
                 setTestPlayed(false);
                 setIsTestPlaying(false);
            };
        }).catch(err => {
            alert(`Playback failed: ${err.message}. Ensure it is a direct download link.`);
        });
    };

    const handleStopTest = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsTestPlaying(false);
        }
    };

    const handleSaveClassSettings = async () => {
        if (!selectedClassForPin) return;
        
        if (mdAlarmUrl && !testPlayed) {
            alert("Please use the 'Test Play' button to verify the audio URL before saving.");
            return;
        }

        setIsSaving(true);
        try {
            if (newDutyPin) {
                if (newDutyPin.length < 4) {
                    throw new Error("PIN must be at least 4 characters long.");
                }
                const { error: pinError } = await (supabase as any).rpc('set_class_duty_pin', {
                    p_class: selectedClassForPin,
                    p_pin: newDutyPin
                });
                if (pinError) throw pinError;
            }

            const { error: mdError } = await (supabase as any).rpc('save_morning_duty_settings', {
                p_class: selectedClassForPin,
                p_enabled: mdEnabled,
                p_alarm_url: mdAlarmUrl,
                p_times: mdTimes,
                p_messages: mdMessages,
                p_weekdays: mdWeekdays,
                p_silent_recess: mdSilentRecess
            });
            if (mdError) throw mdError;

            alert(`Successfully updated settings for ${selectedClassForPin}`);
            setNewDutyPin('');
        } catch (err: any) {
            alert('Failed to update morning duty settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('audio/')) {
            alert('Please select an audio file (mp3, wav).');
            return;
        }

        setIsUploading(true);
        try {
            const fileName = `morning_duties/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('morning_duty_assets')
                .upload(fileName, file, { upsert: false });
                
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('morning_duty_assets')
                .getPublicUrl(uploadData.path);

            const { syncAssetToDrive } = await import('@/utils/googleDriveSync');
            const driveData = await syncAssetToDrive(
                publicUrl, 
                file.name, 
                'Learning_Community/morning_duties'
            );

            if (driveData && driveData.url) {
                // Use Supabase public URL for reliable HTML5 audio playback
                setMdAlarmUrl(publicUrl);
                setTestPlayed(false);
                alert('Audio successfully uploaded to Google Drive! (Using Supabase URL for reliable playback)');
            } else {
                setMdAlarmUrl(publicUrl);
                setTestPlayed(false);
                alert('Uploaded to Supabase successfully (Drive sync failed).');
            }
            fetchFiles(); // Refresh the list of uploaded files
        } catch (err: any) {
            console.error('Upload error:', err);
            alert(`Upload failed: ${err.message}`);
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const renderTable = (
        title: string,
        items: GroupItem[],
        newItemName: string,
        setNewItemName: (val: string) => void,
        onAdd: () => void,
        editingId: string | null,
        setEditingId: (id: string | null) => void,
        editName: string,
        setEditName: (val: string) => void,
        onUpdate: (id: string) => void,
        onDelete: (id: string, name: string) => void,
        onManageMembers?: (name: string) => void
    ) => (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[350px] md:h-[450px]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                <Layers className="text-blue-500" />
                {title}
            </h2>

            {/* Add New */}
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={`New ${title.slice(0, -1)} name`}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && onAdd()}
                />
                <button
                    onClick={onAdd}
                    disabled={!newItemName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                >
                    <Plus size={18} />
                    Add
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="text-center py-8 text-slate-400">Loading...</div>
                ) : items.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">No {title.toLowerCase()} found.</div>
                ) : (
                    <div className="space-y-2">
                        {items.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                                {editingId === item.id ? (
                                    <div className="flex-1 flex gap-2 mr-2">
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 px-3 py-1.5 rounded-lg border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && onUpdate(item.id)}
                                        />
                                        <button onClick={() => onUpdate(item.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                                            <Save size={18} />
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                                            <X size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="font-semibold text-slate-700">{item.name}</span>
                                        <div className="flex items-center gap-1">
                                            {onManageMembers && (
                                                <button
                                                    onClick={() => onManageMembers(item.name)}
                                                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg flex items-center gap-1 text-xs font-bold"
                                                    title="Manage Members"
                                                >
                                                    <Users size={16} />
                                                    Members
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setEditingId(item.id);
                                                    setEditName(item.name);
                                                }}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => onDelete(item.id, item.name)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <AdminLayout title="Class Dashboard Management" icon={<Layers className="w-6 h-6" />}>
            <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderTable(
                        "Classes",
                        classes,
                        newClassName,
                        setNewClassName,
                        handleAddClass,
                        editingClassId,
                        setEditingClassId,
                        editClassName,
                        setEditClassName,
                        handleUpdateClass,
                        handleDeleteClass
                    )}
                    {renderTable(
                        "Extracurricular Activities",
                        activities,
                        newActivityName,
                        setNewActivityName,
                        handleAddActivity,
                        editingActivityId,
                        setEditingActivityId,
                        editActivityName,
                        setEditActivityName,
                        handleUpdateActivity,
                        handleDeleteActivity,
                        setSelectedActivityForMembers
                    )}
                </div>

                {/* Dashboard Management */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                        <Layers className="text-indigo-500" />
                        Class Dashboard Management
                    </h2>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4 items-start">
                            <div className="flex-1 w-full">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Class</label>
                                <select
                                    value={selectedClassForPin}
                                    onChange={(e) => setSelectedClassForPin(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                                >
                                    <option value="">Select a class...</option>
                                    {classes.map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 w-full">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Teacher Duty PIN (Optional change)</label>
                                <input
                                    type="password"
                                    value={newDutyPin}
                                    onChange={(e) => setNewDutyPin(e.target.value)}
                                    placeholder="Enter new numeric PIN"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        {selectedClassForPin && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-4 mt-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-slate-800">Morning Duty Configuration</h3>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className="text-sm font-bold text-slate-600">Enable Morning Duty</span>
                                        <input
                                            type="checkbox"
                                            checked={mdEnabled}
                                            onChange={(e) => setMdEnabled(e.target.checked)}
                                            className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </label>
                                </div>
                                
                                <div className="flex flex-col gap-2">
                                    <label className="block text-sm font-bold text-slate-700">Alarm Audio URL (Upload or Paste Link)</label>
                                    <div className="flex gap-2 relative items-center flex-wrap">
                                        <input
                                            type="text"
                                            value={mdAlarmUrl}
                                            onChange={(e) => handleAlarmUrlChange(e.target.value)}
                                            placeholder="Paste Google Drive link here..."
                                            className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <select 
                                            className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-[150px]"
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    setMdAlarmUrl(e.target.value);
                                                    setTestPlayed(false);
                                                }
                                            }}
                                            value=""
                                        >
                                            <option value="">Select existing file...</option>
                                            {uploadedFiles.map(f => (
                                                <option key={f.url} value={f.url}>{f.name.replace(/^\d+_/, '')}</option>
                                            ))}
                                        </select>
                                        <div className="relative">
                                            <input 
                                                type="file" 
                                                accept="audio/*" 
                                                onChange={handleFileUpload} 
                                                disabled={isUploading}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                                title="Upload Audio File"
                                            />
                                            <button 
                                                disabled={isUploading}
                                                className={`px-4 py-2.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold hover:bg-slate-200 transition-colors ${isUploading ? 'opacity-50' : ''}`}
                                            >
                                                {isUploading ? 'Uploading...' : 'Upload File'}
                                            </button>
                                        </div>
                                        {!isTestPlaying ? (
                                            <button
                                                onClick={handleTestPlay}
                                                disabled={!mdAlarmUrl}
                                                className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 disabled:opacity-50"
                                            >
                                                Test Play
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleStopTest}
                                                className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700"
                                            >
                                                Stop
                                            </button>
                                        )}
                                    </div>
                                    {mdAlarmUrl && !testPlayed && (
                                        <span className="text-xs text-orange-600 font-semibold mt-1">
                                            * You must test play the audio successfully before saving.
                                        </span>
                                    )}
                                </div>

                                {/* Trigger Times & Messages */}
                                <div className="flex flex-col gap-3">
                                    <label className="block text-sm font-bold text-slate-700">Alarm Trigger Times & Reminder Messages</label>
                                    <div className="flex flex-col gap-3">
                                        {[
                                            { key: 'alarm1', label: '⏰ Alarm 1', placeholder: 'e.g. 請同學準備交功課，班長請開始收功課' },
                                            { key: 'alarm2', label: '⏰ Alarm 2', placeholder: 'e.g. 最後提醒！功課即將截止，請盡快交給班長' },
                                            { key: 'alarm3', label: '⏰ Alarm 3', placeholder: 'e.g. 請全體同學安靜，老師即將到來' },
                                            { key: 'deadline', label: '🔒 Deadline (Close PiP)', placeholder: 'e.g. 早會正式開始，功課收集截止' },
                                        ].map(({ key, label, placeholder }) => (
                                            <div key={key} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold text-slate-600 w-28 shrink-0">{label}</span>
                                                    <input
                                                        type="time"
                                                        value={mdTimes[key] || ''}
                                                        onChange={(e) => setMdTimes((prev: any) => ({ ...prev, [key]: e.target.value }))}
                                                        className="px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm font-mono"
                                                    />
                                                </div>
                                                <textarea
                                                    rows={2}
                                                    value={mdMessages[key] || ''}
                                                    onChange={(e) => setMdMessages((prev: any) => ({ ...prev, [key]: e.target.value }))}
                                                    placeholder={placeholder}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none bg-slate-50"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-2">
                                    <button
                                        onClick={() => {
                                            // Local trigger only - handled in ClassDashboardPage via test mode/scheduler
                                            // The user asked to have a "Fire Now" button.
                                            // Actually, "Fire Now" calls the trigger handler LOCALLY using local state.
                                            // In AdminGroupsPage, we cannot trigger the ClassDashboardPage locally since it's a different route.
                                            // Wait, the user said "Fire Now (Test) Button: Calls the trigger handler locally using local state".
                                            alert('To use "Fire Now", open the Class Dashboard in Test Mode for the "Test" class.');
                                        }}
                                        className="px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600"
                                    >
                                        Fire Now (Go to Dashboard)
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end mt-2">
                            <button
                                onClick={handleSaveClassSettings}
                                disabled={isSettingPin || !selectedClassForPin || (!!mdAlarmUrl && !testPlayed)}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                            >
                                <Save size={18} />
                                {isSettingPin ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <GroupMemberModal
                isOpen={!!selectedActivityForMembers}
                onClose={() => setSelectedActivityForMembers(null)}
                activityName={selectedActivityForMembers || ""}
                onUpdate={fetchData}
            />
        </AdminLayout>
    );
}
