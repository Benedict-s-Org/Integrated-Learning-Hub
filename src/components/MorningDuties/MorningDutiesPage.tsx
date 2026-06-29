import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
    Clock, 
    Settings, 
    CheckCircle, 
    AlertTriangle, 
    User, 
    Shield, 
    Save, 
    X, 
    Check, 
    Crown, 
    Users,
    ArrowLeft,
    RefreshCw,
    Calendar,
    Volume2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { playSuccessSound } from '@/utils/audio';

interface RosterStudent {
    id: string;
    display_name: string | null;
    class: string | null;
    class_number: number | null;
    group_no: number | null;
    is_group_leader: boolean;
    // Log fields
    log_id?: string;
    status: 'todo' | 'submitted' | 'missing' | 'absent' | 'late' | 'exempted';
    set_by: 'self' | 'leader' | 'teacher' | 'system';
    snapshot_0830: string | null;
    snapshot_0835: string | null;
    reminded: boolean;
    made_up: boolean;
    made_up_at: string | null;
    notes: string | null;
}

interface TimesConfig {
    alarm1: string;
    alarm2: string;
    alarm3: string;
    deadline: string;
}

interface MessagesConfig {
    before_alarm1: string;
    alarm1_to_alarm2: string;
    alarm2_to_alarm3: string;
    alarm3_to_deadline: string;
    after_deadline: string;
}

interface ClassSettings {
    class: string;
    enabled: boolean;
    alarm_url: string | null;
    times: TimesConfig;
    messages: MessagesConfig;
    weekdays: number[];
    silent_recess: boolean;
}

const DEFAULT_TIMES: TimesConfig = {
    alarm1: '08:05',
    alarm2: '08:08',
    alarm3: '08:30',
    deadline: '08:35'
};

const DEFAULT_MESSAGES: MessagesConfig = {
    before_alarm1: '請盡快交功課。',
    alarm1_to_alarm2: '第一響鐘已過，請迅速交功課。',
    alarm2_to_alarm3: '第二響鐘已過，請安靜交功課。',
    alarm3_to_deadline: '即將截止登記，未交者請速補交。',
    after_deadline: '登記時間已截止。'
};

export function MorningDutiesPage() {
    const { user, isStaff } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Active class state (default to 3A or URL param or user class)
    const [selectedClass, setSelectedClass] = useState<string>(() => {
        return searchParams.get('class') || user?.class || '3A';
    });

    // Roster and Settings State
    const [roster, setRoster] = useState<RosterStudent[]>([]);
    const [settings, setSettings] = useState<ClassSettings | null>(null);
    const [allAvailableClasses, setAllAvailableClasses] = useState<string[]>(['3A']);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // HK Current Time
    const [hkTime, setHkTime] = useState<string>('08:00');

    // Modals
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'messages' | 'groups'>('general');
    const [selectedStudentForClick, setSelectedStudentForClick] = useState<RosterStudent | null>(null);
    const [statusUpdating, setStatusUpdating] = useState(false);

    // Form inputs (Settings Modal copy)
    const [formEnabled, setFormEnabled] = useState(true);
    const [formAlarmUrl, setFormAlarmUrl] = useState('');
    const [formWeekdays, setFormWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
    const [formSilentRecess, setFormSilentRecess] = useState(false);
    const [formTimes, setFormTimes] = useState<TimesConfig>(DEFAULT_TIMES);
    const [formMessages, setFormMessages] = useState<MessagesConfig>(DEFAULT_MESSAGES);
    const [groupingsCopy, setGroupingsCopy] = useState<Record<string, { group_no: number | null; is_group_leader: boolean }>>({});

    // Fetch Date Helpers
    const getHKDateString = () => {
        const d = new Date();
        return new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'Asia/Hong_Kong', 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).format(d);
    };

    const getHKTimeComponents = () => {
        const d = new Date();
        const hkString = d.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' });
        const hkDate = new Date(hkString);
        const hours = hkDate.getHours();
        const minutes = hkDate.getMinutes();
        return { 
            hours, 
            minutes, 
            formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` 
        };
    };

    // HK Clock Tick
    useEffect(() => {
        setHkTime(getHKTimeComponents().formatted);
        const interval = setInterval(() => {
            setHkTime(getHKTimeComponents().formatted);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Sync class select changes to query params
    useEffect(() => {
        if (selectedClass) {
            setSearchParams({ class: selectedClass });
            loadRosterAndSettings();
        }
    }, [selectedClass]);

    // Query unique classes in the system
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const { data } = await supabase
                    .from('users')
                    .select('class')
                    .not('class', 'is', null);
                if (data) {
                    const unique = Array.from(new Set(data.map(d => d.class))).filter(Boolean) as string[];
                    setAllAvailableClasses(unique.sort());
                }
            } catch (err) {
                console.warn('Failed to load class list', err);
            }
        };
        fetchClasses();
    }, []);

    // Initialize logs & fetch list
    const loadRosterAndSettings = async () => {
        setIsLoading(true);
        try {
            const todayStr = getHKDateString();

            // 1. Call DB initialization RPC
            const { error: initError } = await supabase.rpc('initialize_morning_duty_logs', {
                p_class: selectedClass,
                p_date: todayStr
            });
            if (initError) {
                console.warn('[MorningDuties] Error initializing logs:', initError.message);
            }

            // 2. Fetch Users in Class
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('id, display_name, class, class_number, group_no, is_group_leader')
                .eq('class', selectedClass)
                .eq('role', 'user')
                .order('class_number', { ascending: true });

            if (usersError) throw usersError;

            // 3. Fetch logs for today
            const { data: logsData, error: logsError } = await supabase
                .from('morning_duty_logs')
                .select('*')
                .eq('log_date', todayStr)
                .eq('class', selectedClass);

            if (logsError) throw logsError;

            // 4. Merge
            const rosterList: RosterStudent[] = (usersData || []).map(u => {
                const log = (logsData || []).find(l => l.student_id === u.id);
                return {
                    id: u.id,
                    display_name: u.display_name,
                    class: u.class,
                    class_number: u.class_number,
                    group_no: u.group_no,
                    is_group_leader: u.is_group_leader,
                    log_id: log?.id,
                    status: log?.status || 'todo',
                    set_by: log?.set_by || 'system',
                    snapshot_0830: log?.snapshot_0830 || null,
                    snapshot_0835: log?.snapshot_0835 || null,
                    reminded: log?.reminded || false,
                    made_up: log?.made_up || false,
                    made_up_at: log?.made_up_at || null,
                    notes: log?.notes || null
                };
            });

            setRoster(rosterList);

            // Populate groupings copy for Settings modal editing
            const groupings: Record<string, { group_no: number | null; is_group_leader: boolean }> = {};
            rosterList.forEach(r => {
                groupings[r.id] = { group_no: r.group_no, is_group_leader: r.is_group_leader };
            });
            setGroupingsCopy(groupings);

            // 5. Fetch settings row
            const { data: settingsData, error: settingsError } = await supabase
                .from('morning_duty_settings')
                .select('*')
                .eq('class', selectedClass)
                .maybeSingle();

            if (settingsError) throw settingsError;

            if (settingsData) {
                const fetchedTimes = { ...DEFAULT_TIMES, ...((settingsData.times as any) || {}) };
                const fetchedMsgs = { ...DEFAULT_MESSAGES, ...((settingsData.messages as any) || {}) };

                setSettings({
                    class: settingsData.class,
                    enabled: settingsData.enabled,
                    alarm_url: settingsData.alarm_url,
                    times: fetchedTimes,
                    messages: fetchedMsgs,
                    weekdays: settingsData.weekdays || [1, 2, 3, 4, 5],
                    silent_recess: settingsData.silent_recess
                });
                // Form setup
                setFormEnabled(settingsData.enabled);
                setFormAlarmUrl(settingsData.alarm_url || '');
                setFormWeekdays(settingsData.weekdays || [1, 2, 3, 4, 5]);
                setFormSilentRecess(settingsData.silent_recess);
                setFormTimes(fetchedTimes);
                setFormMessages(fetchedMsgs);
            } else {
                // Default settings fallback
                setSettings({
                    class: selectedClass,
                    enabled: true,
                    alarm_url: null,
                    times: DEFAULT_TIMES,
                    messages: DEFAULT_MESSAGES,
                    weekdays: [1, 2, 3, 4, 5],
                    silent_recess: false
                });
                setFormEnabled(true);
                setFormAlarmUrl('');
                setFormWeekdays([1, 2, 3, 4, 5]);
                setFormSilentRecess(false);
                setFormTimes(DEFAULT_TIMES);
                setFormMessages(DEFAULT_MESSAGES);
            }

        } catch (err) {
            console.error('Failed to load morning duties info:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate Stage Message
    const stageInfo = useMemo(() => {
        if (!settings) {
            return { stage: 1, label: '第一階段 (預備)', message: DEFAULT_MESSAGES.before_alarm1 };
        }
        const times = settings.times;
        const msgs = settings.messages;

        if (hkTime < times.alarm1) {
            return { stage: 1, label: '第一階段 (預備)', message: msgs.before_alarm1 || DEFAULT_MESSAGES.before_alarm1 };
        } else if (hkTime < times.alarm2) {
            return { stage: 2, label: '第二階段 (警報 1)', message: msgs.alarm1_to_alarm2 || DEFAULT_MESSAGES.alarm1_to_alarm2 };
        } else if (hkTime < times.alarm3) {
            return { stage: 3, label: '第三階段 (警報 2)', message: msgs.alarm2_to_alarm3 || DEFAULT_MESSAGES.alarm2_to_alarm3 };
        } else if (hkTime < times.deadline) {
            return { stage: 4, label: '第四階段 (即將截止)', message: msgs.alarm3_to_deadline || DEFAULT_MESSAGES.alarm3_to_deadline };
        } else {
            return { stage: 5, label: '第五階段 (登記結束)', message: msgs.after_deadline || DEFAULT_MESSAGES.after_deadline };
        }
    }, [hkTime, settings]);

    // Roster Grid sorting: green-sorted to the back
    const sortedRoster = useMemo(() => {
        return [...roster].sort((a, b) => {
            const isSubA = a.status === 'submitted';
            const isSubB = b.status === 'submitted';
            if (isSubA && !isSubB) return 1;  // Submitted goes back
            if (!isSubA && isSubB) return -1; // Non-submitted remains front
            return (a.class_number || 999) - (b.class_number || 999);
        });
    }, [roster]);

    // student tab click -> open popup
    const handleStudentCardClick = (student: RosterStudent) => {
        setSelectedStudentForClick(student);
    };

    // Safe status update
    const submitStatusChange = async (newStatus: 'submitted' | 'missing') => {
        if (!selectedStudentForClick) return;
        setStatusUpdating(true);
        try {
            const todayStr = getHKDateString();
            const student = selectedStudentForClick;

            const { error } = await supabase.rpc('upsert_morning_duty_log', {
                p_log_date: todayStr,
                p_student_id: student.id,
                p_status: newStatus,
                p_set_by: 'self',
                p_snapshot_0830: student.snapshot_0830,
                p_snapshot_0835: student.snapshot_0835,
                p_reminded: student.reminded,
                p_made_up: student.made_up,
                p_made_up_at: student.made_up_at,
                p_notes: student.notes,
                p_missing_items: null,
                p_event_type: 'student_click'
            });

            if (error) throw error;

            playSuccessSound();
            setSelectedStudentForClick(null);
            await loadRosterAndSettings();
        } catch (err) {
            console.error('Failed to update status:', err);
            alert('變更狀態失敗，請重試');
        } finally {
            setStatusUpdating(false);
        }
    };

    // Leader Confirm Button Action
    const handleLeaderConfirm = async () => {
        try {
            const { error } = await supabase.rpc('log_morning_duty_event', {
                p_class: selectedClass,
                p_event_type: 'leader_confirm',
                p_status_value: null,
                p_student_id: null,
                p_log_id: null
            });
            if (error) throw error;
            playSuccessSound();
            alert('組長已確認今日功課收集完畢！');
        } catch (err: any) {
            console.error('Failed to log confirm:', err);
            alert(`確認失敗: ${err.message || '未知錯誤'}`);
        }
    };

    // Save general, times, messages settings
    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            // Write general settings
            const { error } = await supabase.rpc('save_morning_duty_settings', {
                p_class: selectedClass,
                p_enabled: formEnabled,
                p_alarm_url: formAlarmUrl || null,
                p_times: formTimes,
                p_messages: formMessages,
                p_weekdays: formWeekdays,
                p_silent_recess: formSilentRecess
            });

            if (error) throw error;

            playSuccessSound();
            setShowSettingsModal(false);
            await loadRosterAndSettings();
        } catch (err: any) {
            console.error('Error saving settings:', err);
            alert(`儲存設定失敗: ${err.message}`);
        } finally {
            setIsSavingSettings(false);
        }
    };

    // Save Student groups inside tab
    const handleSaveGroups = async () => {
        setIsSavingSettings(true);
        try {
            const promises = Object.keys(groupingsCopy).map(async (studentId) => {
                const copy = groupingsCopy[studentId];
                const original = roster.find(r => r.id === studentId);
                if (!original) return;

                // Only update if changed
                if (original.group_no !== copy.group_no || original.is_group_leader !== copy.is_group_leader) {
                    const { error } = await supabase.rpc('update_student_group_settings', {
                        p_student_id: studentId,
                        p_group_no: copy.group_no,
                        p_is_group_leader: copy.is_group_leader
                    });
                    if (error) throw error;
                }
            });

            await Promise.all(promises);
            playSuccessSound();
            alert('學生分組及組長設定已成功更新！');
            await loadRosterAndSettings();
        } catch (err: any) {
            console.error('Error saving groups:', err);
            alert(`更新分組失敗: ${err.message}`);
        } finally {
            setIsSavingSettings(false);
        }
    };

    // Manual recess reset button
    const handleResetRecess = async () => {
        if (!confirm('確認手動重置下課安靜狀態？')) return;
        try {
            const { error } = await supabase.rpc('save_morning_duty_settings', {
                p_class: selectedClass,
                p_enabled: formEnabled,
                p_alarm_url: formAlarmUrl || null,
                p_times: formTimes,
                p_messages: formMessages,
                p_weekdays: formWeekdays,
                p_silent_recess: false
            });
            if (error) throw error;
            setFormSilentRecess(false);
            if (settings) setSettings({ ...settings, silent_recess: false });
            playSuccessSound();
            alert('下課安靜狀態已手動清除！');
        } catch (err: any) {
            alert(`操作失敗: ${err.message}`);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-3">
                <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-slate-400 font-bold uppercase tracking-wider text-sm">載入晨安登記中...</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            
            {/* Header Toolbar */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-slate-50 text-slate-500 rounded-xl transition-all"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <Clock className="text-blue-500" />
                            晨風班務 (Morning Duties)
                        </h1>
                        <p className="text-xs text-slate-400">Class Check-in Dashboard</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Class Selector for staff */}
                    {isStaff && (
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="px-4 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-sm shadow-inner outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            {allAvailableClasses.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    )}

                    {/* Settings Cog */}
                    {isStaff && (
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-blue-600 rounded-xl shadow-sm transition-all"
                            title="Manage Settings"
                        >
                            <Settings size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Window: Instruction Panel */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                        
                        {/* Decorative bubbles */}
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-white/10 blur-[40px] rounded-full" />
                        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-indigo-500/20 blur-[40px] rounded-full" />
                        
                        <div className="relative space-y-6">
                            <div className="flex items-center justify-between border-b border-white/20 pb-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">Hong Kong Time</p>
                                    <h2 className="text-4xl font-black tracking-tight tabular-nums mt-1">{hkTime}</h2>
                                </div>
                                <div className="px-3 py-1 bg-white/10 rounded-full border border-white/20 text-xs font-semibold backdrop-blur-sm">
                                    {stageInfo.label}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">現階段指示 (Instructions)</p>
                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 min-h-[80px] flex items-center justify-center text-center">
                                    <p className="font-bold text-lg leading-relaxed">{stageInfo.message}</p>
                                </div>
                            </div>

                            {/* Group Leader Confirm Button */}
                            {((user?.is_group_leader) || isStaff) && (
                                <button
                                    onClick={handleLeaderConfirm}
                                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-wider shadow-lg shadow-emerald-700/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={18} />
                                    組長確認登記完畢
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Stats Card */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 p-6 space-y-4">
                        <h3 className="font-black text-slate-800 text-sm tracking-tight border-b border-slate-100 pb-2">
                            統計進度 (Progress)
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="bg-green-50/50 rounded-2xl p-3 border border-green-100/30">
                                <p className="text-green-600 text-[10px] font-black uppercase tracking-wider">交齊功課</p>
                                <p className="text-2xl font-black text-green-700 mt-1">
                                    {roster.filter(r => r.status === 'submitted').length}
                                </p>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-wider">未交/缺席/豁免</p>
                                <p className="text-2xl font-black text-slate-700 mt-1">
                                    {roster.filter(r => r.status !== 'submitted').length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Window: Student Name-Tab Grid */}
                <div className="col-span-12 lg:col-span-8 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="font-black text-slate-800 text-sm tracking-tight flex items-center gap-2">
                            <Users size={16} className="text-blue-500" />
                            學生登記名冊 ({selectedClass})
                        </h3>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                            {roster.length} STUDENTS
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {sortedRoster.map(student => {
                            const isSubmitted = student.status === 'submitted' || student.status === 'exempted';
                            const isMissing = student.status === 'missing';
                            const isExempted = student.status === 'exempted';
                            
                            return (
                                <button
                                    key={student.id}
                                    onClick={() => handleStudentCardClick(student)}
                                    className={`
                                        relative p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center gap-2 h-24 transition-all duration-200 active:scale-95 group shadow-sm
                                        ${isExempted 
                                            ? 'bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100/70 shadow-blue-100'
                                            : isSubmitted 
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100/70 shadow-emerald-100' 
                                            : isMissing 
                                            ? 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100/70 shadow-rose-100'
                                            : 'bg-white border-slate-100 text-slate-700 hover:border-slate-200 hover:shadow-md'
                                        }
                                    `}
                                >
                                    {/* Crowns and Roles indicator */}
                                    <div className="absolute top-2 right-2 flex items-center gap-1">
                                        {student.is_group_leader && (
                                            <Crown size={12} className="text-amber-500 fill-amber-500" title="Group Leader" />
                                        )}
                                        {student.group_no !== null && (
                                            <span className="bg-slate-100/80 backdrop-blur-sm text-[8px] font-black text-slate-500 px-1 py-0.5 rounded border border-slate-200">
                                                G{student.group_no}
                                            </span>
                                        )}
                                    </div>

                                    {/* Class seat number */}
                                    <div className={`
                                        w-6 h-6 rounded-lg font-black text-[10px] flex items-center justify-center transition-all
                                        ${isExempted 
                                            ? 'bg-blue-200/50 text-blue-700'
                                            : isSubmitted 
                                            ? 'bg-emerald-200/50 text-emerald-700'
                                            : isMissing
                                            ? 'bg-rose-200/50 text-rose-700'
                                            : 'bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'
                                        }
                                    `}>
                                        {student.class_number || '•'}
                                    </div>

                                    {/* Student display name */}
                                    <p className="font-bold text-sm truncate w-full max-w-[120px] tracking-tight">
                                        {student.display_name || '未命名'}
                                    </p>

                                    {isExempted && (
                                       <div className="absolute -top-2 -right-2 bg-blue-400 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">
                                           豁免
                                       </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

            </div>

            {/* Click student card status modal */}
            {selectedStudentForClick && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl border border-slate-100 w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        
                        <div className="p-6 text-center space-y-4">
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto border border-blue-100">
                                <User size={28} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-black text-lg text-slate-800">
                                    你是 {selectedStudentForClick.display_name} 嗎？
                                </h4>
                                <p className="text-xs text-slate-400">
                                    班級: {selectedClass} &nbsp;|&nbsp; 學號: #{selectedStudentForClick.class_number || '-'}
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-col gap-2">
                            <button
                                onClick={() => submitStatusChange('submitted')}
                                disabled={statusUpdating}
                                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm tracking-wide shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle size={16} />
                                交齊功課 (Submitted)
                            </button>
                            <button
                                onClick={() => submitStatusChange('missing')}
                                disabled={statusUpdating}
                                className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-sm tracking-wide shadow-md shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <AlertTriangle size={16} />
                                欠功課 (Missing)
                            </button>
                            <button
                                onClick={() => setSelectedStudentForClick(null)}
                                disabled={statusUpdating}
                                className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm border border-slate-200 active:scale-95 transition-all"
                            >
                                取消 (Cancel)
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* Settings Modal (Admins / Class Staff only) */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2rem] border border-slate-100 w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                        
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                            <div>
                                <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                                    <Settings size={20} className="text-slate-500" />
                                    晨風班務設定 ({selectedClass})
                                </h3>
                                <p className="text-xs text-slate-400">Class Morning Duty System Settings</p>
                            </div>
                            <button 
                                onClick={() => setShowSettingsModal(false)}
                                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tabs Bar */}
                        <div className="flex border-b border-slate-100 bg-slate-50/30 px-6">
                            {[
                                { id: 'general', label: '基本設定 (General)', icon: Settings },
                                { id: 'messages', label: '時段指示 (Messages)', icon: Clock },
                                { id: 'groups', label: '學生分組 (Groups)', icon: Users }
                            ].map(tab => {
                                const isActive = activeSettingsTab === tab.id;
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveSettingsTab(tab.id as any)}
                                        className={`
                                            flex items-center gap-2 py-4 px-4 font-bold text-xs border-b-2 transition-all outline-none
                                            ${isActive 
                                                ? 'border-blue-500 text-blue-600 font-black' 
                                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                            }
                                        `}
                                    >
                                        <Icon size={14} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                            
                            {/* General Tab */}
                            {activeSettingsTab === 'general' && (
                                <div className="space-y-4">
                                    {/* Enabled Switch */}
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div>
                                            <p className="font-bold text-sm text-slate-800">啟用晨風登記 (Enable Morning Duties)</p>
                                            <p className="text-xs text-slate-400">啟用後學生可看見此功能並進行功課登記</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formEnabled}
                                                onChange={(e) => setFormEnabled(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>

                                    {/* Alarm URL */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <Volume2 size={14} />
                                            警報音效連結 (Alarm Audio URL)
                                        </label>
                                        <input
                                            type="text"
                                            value={formAlarmUrl}
                                            onChange={(e) => setFormAlarmUrl(e.target.value)}
                                            placeholder="e.g. https://example.com/sound.mp3"
                                            className="w-full px-4 py-3 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-400 focus:bg-white transition-all shadow-inner"
                                        />
                                    </div>

                                    {/* Weekdays */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <Calendar size={14} />
                                            登記工作日 (Weekdays)
                                        </label>
                                        <div className="grid grid-cols-7 gap-2">
                                            {[
                                                { val: 1, label: '一' },
                                                { val: 2, label: '二' },
                                                { val: 3, label: '三' },
                                                { val: 4, label: '四' },
                                                { val: 5, label: '五' },
                                                { val: 6, label: '六' },
                                                { val: 7, label: '日' }
                                            ].map(day => {
                                                const checked = formWeekdays.includes(day.val);
                                                return (
                                                    <button
                                                        key={day.val}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormWeekdays(prev => 
                                                                checked ? prev.filter(v => v !== day.val) : [...prev, day.val].sort()
                                                            );
                                                        }}
                                                        className={`
                                                            py-2 border rounded-xl font-black text-xs transition-all duration-150
                                                            ${checked 
                                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                                                            }
                                                        `}
                                                    >
                                                        {day.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Silent Recess (Read-only for Phase 2) */}
                                    <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-sm text-indigo-900 flex items-center gap-1.5">
                                                下課安靜狀態 (Silent Recess)
                                            </p>
                                            <p className="text-[10px] text-indigo-600 font-semibold mt-1">
                                                系統自動管理狀態: &nbsp; 
                                                <span className="font-black text-xs underline uppercase">
                                                    {formSilentRecess ? '安靜休整中 (SILENT ACTIVE)' : '正常下課 (NORMAL)'}
                                                </span>
                                            </p>
                                        </div>
                                        {formSilentRecess && (
                                            <button
                                                type="button"
                                                onClick={handleResetRecess}
                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-lg shadow transition-all"
                                            >
                                                手動清除 (Reset)
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Times & Messages Tab */}
                            {activeSettingsTab === 'messages' && (
                                <div className="space-y-6">
                                    {/* Bounding Times */}
                                    <div className="space-y-3">
                                        <h4 className="font-black text-slate-800 text-xs tracking-wider uppercase border-l-4 border-blue-500 pl-2">
                                            時間節點設定 (Time Boundaries)
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            {[
                                                { key: 'alarm1', label: '警報 1 時間 (Alarm 1)' },
                                                { key: 'alarm2', label: '警報 2 時間 (Alarm 2)' },
                                                { key: 'alarm3', label: '警報 3 時間 (Alarm 3)' },
                                                { key: 'deadline', label: '截止登記時間 (Deadline)' }
                                            ].map(t => (
                                                <div key={t.key} className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t.label}</label>
                                                    <input
                                                        type="time"
                                                        value={formTimes[t.key as keyof TimesConfig]}
                                                        onChange={(e) => setFormTimes({
                                                            ...formTimes,
                                                            [t.key]: e.target.value
                                                        })}
                                                        className="w-full px-4 py-2.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-400 focus:bg-white transition-all shadow-inner"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Stage Messages */}
                                    <div className="space-y-4">
                                        <h4 className="font-black text-slate-800 text-xs tracking-wider uppercase border-l-4 border-blue-500 pl-2">
                                            階段提示設定 (Stage Messages)
                                        </h4>
                                        {[
                                            { key: 'before_alarm1', label: '第一階段提示 (預備鐘前)' },
                                            { key: 'alarm1_to_alarm2', label: '第二階段提示 (第一警報響起)' },
                                            { key: 'alarm2_to_alarm3', label: '第三階段提示 (第二警報響起)' },
                                            { key: 'alarm3_to_deadline', label: '第四階段提示 (即將截止前)' },
                                            { key: 'after_deadline', label: '第五階段提示 (已截止後)' }
                                        ].map(m => (
                                            <div key={m.key} className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{m.label}</label>
                                                <textarea
                                                    rows={2}
                                                    value={formMessages[m.key as keyof MessagesConfig]}
                                                    onChange={(e) => setFormMessages({
                                                        ...formMessages,
                                                        [m.key]: e.target.value
                                                    })}
                                                    className="w-full px-4 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-400 focus:bg-white transition-all shadow-inner resize-none"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Student Grouping Tab */}
                            {activeSettingsTab === 'groups' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <h4 className="font-black text-slate-800 text-xs tracking-wider uppercase border-l-4 border-blue-500 pl-2">
                                            小組及組長分配 (Groups Allocation)
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={handleSaveGroups}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                            <Save size={14} />
                                            儲存分組 (Save Groups)
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-inner">
                                        <table className="w-full border-collapse text-left">
                                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 uppercase tracking-wider">學號</th>
                                                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 uppercase tracking-wider">學生姓名</th>
                                                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 uppercase tracking-wider text-center">組別 (Group No)</th>
                                                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 uppercase tracking-wider text-center">組長 (Leader)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {roster.map(student => {
                                                    const stdCopy = groupingsCopy[student.id] || { group_no: null, is_group_leader: false };
                                                    return (
                                                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-3 font-bold text-slate-400 text-xs">#{student.class_number || '-'}</td>
                                                            <td className="px-4 py-3 font-black text-slate-700 text-sm">{student.display_name}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={20}
                                                                    value={stdCopy.group_no ?? ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value === '' ? null : parseInt(e.target.value);
                                                                        setGroupingsCopy(prev => ({
                                                                            ...prev,
                                                                            [student.id]: {
                                                                                ...prev[student.id],
                                                                                group_no: val
                                                                            }
                                                                        }));
                                                                    }}
                                                                    className="w-16 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={stdCopy.is_group_leader}
                                                                    onChange={(e) => {
                                                                        setGroupingsCopy(prev => ({
                                                                            ...prev,
                                                                            [student.id]: {
                                                                                ...prev[student.id],
                                                                                is_group_leader: e.target.checked
                                                                            }
                                                                        }));
                                                                    }}
                                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded border-slate-200"
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Modal Footer (only visible for Settings tabs, not student list) */}
                        {activeSettingsTab !== 'groups' && (
                            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
                                <button
                                    onClick={() => setShowSettingsModal(false)}
                                    className="px-4 py-2 text-xs font-bold rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    取消 (Cancel)
                                </button>
                                <button
                                    onClick={handleSaveSettings}
                                    disabled={isSavingSettings}
                                    className="flex items-center gap-1.5 px-6 py-2.5 text-xs rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 active:scale-95"
                                >
                                    {isSavingSettings ? (
                                        <>
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                            儲存中...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            儲存設定 (Save)
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}

export default MorningDutiesPage;
