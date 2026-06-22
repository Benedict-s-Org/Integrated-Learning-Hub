import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Clock, BookOpen, AlertTriangle, UserX, Lock, Unlock, Settings } from 'lucide-react';
import { getHKTodayString } from '@/utils/dateUtils';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SUB_OPTIONS } from '@/constants/rewardConfig';

interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    class?: string | null;
    class_number: number | null;
    morning_status?: 'todo' | 'review' | 'completed' | 'absent';
    last_morning_update?: string;
}

interface MorningDutyLog {
    id: string;
    student_id: string;
    status: 'todo' | 'submitted' | 'missing' | 'absent' | 'late';
    handbook_written: boolean;
    missing_items?: Record<string, string[]>;
}

interface MorningDutiesBoardProps {
    users: UserWithCoins[];
    activeClass: string;
    dailyHomeworkMap: Record<string, Record<string, string[]>>;
    onSetupDailyHomework: (className: string, items: Record<string, string[]>) => Promise<void>;
    onStatusChange: () => void;
    isPipView?: boolean;
    displayTimeOverride?: string | null;
    stageTextOverride?: string | null;
    onConfirmStage?: () => void;
}

export const MorningDutiesBoard: React.FC<MorningDutiesBoardProps> = ({ 
    users, activeClass, dailyHomeworkMap, onSetupDailyHomework, onStatusChange, isPipView, displayTimeOverride, stageTextOverride, onConfirmStage
}) => {
    const today = getHKTodayString();
    
    const [currentTime, setCurrentTime] = useState<string>('');
    const [logs, setLogs] = useState<Record<string, MorningDutyLog>>({});
    
    // Modals
    const [selectedStudent, setSelectedStudent] = useState<UserWithCoins | null>(null);
    const [showChoiceModal, setShowChoiceModal] = useState(false);
    const [showOverwriteModal, setShowOverwriteModal] = useState(false);
    const [pendingChoice, setPendingChoice] = useState<'submitted' | 'missing' | 'absent' | null>(null);
    const [showMissingFlow, setShowMissingFlow] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    
    // Missing Flow State
    const [missingItems, setMissingItems] = useState<Record<string, string[]>>({});
    const [homeworkOptions, setHomeworkOptions] = useState<Record<string, string[]>>(DEFAULT_SUB_OPTIONS);
    const [isSetupMode, setIsSetupMode] = useState(false);

    // Form inputs
    const [pinInput, setPinInput] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [pinError, setPinError] = useState('');
    const [isLockedOut, setIsLockedOut] = useState(false);
    const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    useEffect(() => {
        if (displayTimeOverride) return;
        const getHKTime = () => {
            const d = new Date();
            const hkStr = d.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' });
            const hkDate = new Date(hkStr);
            const h = String(hkDate.getHours()).padStart(2, '0');
            const m = String(hkDate.getMinutes()).padStart(2, '0');
            return `${h}:${m}`;
        };
        setCurrentTime(getHKTime());
        const timer = setInterval(() => setCurrentTime(getHKTime()), 1000);
        return () => clearInterval(timer);
    }, [displayTimeOverride]);

    const displayTime = displayTimeOverride || currentTime;

    useEffect(() => {
        fetchLogs();
        fetchHomeworkOptions();
    }, [activeClass]);

    const fetchLogs = async () => {
        if (!activeClass || activeClass === 'all') return;
        const { data } = await supabase
            .from('morning_duty_logs')
            .select('*')
            .eq('class', activeClass)
            .eq('log_date', today);
        
        if (data) {
            const logMap: Record<string, MorningDutyLog> = {};
            data.forEach(log => {
                logMap[log.student_id] = log;
            });
            setLogs(logMap);
        }
    };

    const fetchHomeworkOptions = async () => {
        const { data } = await supabase
            .from('class_rewards')
            .select('sub_options')
            .eq('title', '完成班務（欠功課）')
            .single() as any;
        if (data?.sub_options) {
            setHomeworkOptions({ ...DEFAULT_SUB_OPTIONS, ...data.sub_options });
        }
    };

    const handleConfirmStage = async () => {
        if (!activeClass || activeClass === 'all') return;
        try {
            await supabase.rpc('log_morning_duty_event', {
                p_class: activeClass,
                p_event_type: 'leader_confirm'
            });
            onConfirmStage?.(); // Stop alarm audio in parent
            showToast('Stage Confirmed Successfully!', 'success');
        } catch (e: any) {
            showToast('Failed: ' + e.message, 'error');
        }
    };

    const handleStudentClick = (student: UserWithCoins) => {
        const currentStatus = logs[student.id]?.status || 'todo';
        setSelectedStudent(student);
        if (currentStatus === 'missing' && !logs[student.id]?.handbook_written) {
            // Already missing, opening choices adds "Handook Written" via pin
            setPendingChoice(null);
            setShowChoiceModal(true);
        } else {
            setShowChoiceModal(true);
        }
    };

    const selectChoice = (choice: 'submitted' | 'missing' | 'absent') => {
        const currentStatus = logs[selectedStudent!.id]?.status || 'todo';
        setPendingChoice(choice);
        if (currentStatus !== 'todo' && currentStatus !== choice) {
            setShowChoiceModal(false);
            setShowOverwriteModal(true);
        } else {
            processChoice(choice);
        }
    };

    const processChoice = async (choice: 'submitted' | 'missing' | 'absent') => {
        setShowOverwriteModal(false);
        if (choice === 'missing') {
            const todayHomework = dailyHomeworkMap[activeClass];
            if (!todayHomework || Object.keys(todayHomework).length === 0) {
                setIsSetupMode(true);
                setMissingItems({});
            } else {
                setIsSetupMode(false);
                setMissingItems({});
            }
            setShowChoiceModal(false);
            setShowMissingFlow(true);
        } else {
            // Direct submission
            await saveLogStatus(choice);
            setShowChoiceModal(false);
        }
    };

    const saveLogStatus = async (status: 'submitted' | 'missing' | 'absent', items?: Record<string, string[]>) => {
        try {
            await supabase.rpc('upsert_morning_duty_log', {
                p_log_date: today,
                p_student_id: selectedStudent!.id,
                p_status: status,
                p_set_by: 'teacher',
                p_missing_items: items || null,
                p_event_type: 'status_change'
            });
            await fetchLogs();
            onStatusChange();
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    const handleMissingConfirm = async () => {
        if (isSetupMode) {
            if (Object.keys(missingItems).length === 0) {
                if (!confirm("Are you sure there is NO homework for today?")) return;
            } else {
                if (!confirm("你正在設定的是「今日要交嘅功課」，不是你欠交的功課。確定嗎？\n(You are configuring today's homework for the whole class, not what you are missing. Confirm?)")) return;
            }
            await onSetupDailyHomework(activeClass, missingItems);
            // Close modal after setup to prevent accidentally giving coins to the student clicked
            setShowMissingFlow(false);
            setIsSetupMode(false);
            setMissingItems({});
            setSelectedStudent(null);
        } else {
            // Saving student's missing items
            await saveLogStatus('missing', missingItems);
            setShowMissingFlow(false);
            setSelectedStudent(null);
        }
    };

    const submitPin = async () => {
        try {
            const { data, error } = await supabase.rpc('confirm_handbook_written', {
                p_student_id: selectedStudent!.id,
                p_pin: pinInput
            });
            if (error) throw error;

            if (data === 'success') {
                setShowPinModal(false);
                setShowChoiceModal(false);
                setPinInput('');
                setPinError('');
                await fetchLogs();
                onStatusChange();
            } else if (data === 'wrong_pin') {
                setPinError('錯誤 PIN 碼 (Wrong PIN). Please try again.');
            } else if (data === 'locked_out') {
                setPinError('已鎖定！失敗次數過多。(Locked out — too many failed attempts.)');
                setIsLockedOut(true);
            } else if (data === 'no_pin_set') {
                setPinError('此班尚未設定 PIN 碼。(No PIN has been set for this class.)');
                setShowPinModal(false);
            } else if (data === 'no_log') {
                setPinError('找不到今日記錄。(No log found for today.)');
                setShowPinModal(false);
            } else if (data === 'invalid_status') {
                setPinError('學生狀態不是「欠功課」，無需寫手冊。(Student is not in missing status.)');
                setShowPinModal(false);
            } else if (data === 'already_written') {
                setPinError('手冊已登記過。(Handbook already marked as written.)');
                setShowPinModal(false);
            } else {
                setPinError('未知回應: ' + data);
            }
        } catch (e: any) {
            setPinError(e.message);
        }
    };

    const submitUnlock = async () => {
        try {
            const { data, error } = await supabase.rpc('unlock_pin_attempts', {
                p_class: activeClass,
                p_admin_password: adminPassword
            });
            if (error) throw error;
            if (data) {
                setIsLockedOut(false);
                setShowUnlockModal(false);
                setPinError('');
                setAdminPassword('');
            } else {
                setPinError('Incorrect admin password');
            }
        } catch (e: any) {
            setPinError(e.message);
        }
    };

    // Calculate Stats
    const todoCount = users.filter(u => (logs[u.id]?.status || 'todo') === 'todo').length;
    const submittedCount = users.filter(u => logs[u.id]?.status === 'submitted').length;
    const absentCount = users.filter(u => logs[u.id]?.status === 'absent').length;
    const missingTotal = users.filter(u => logs[u.id]?.status === 'missing');
    // Students who are missing BUT have confirmed handbook are treated as Done
    const handbookDoneUsers = missingTotal.filter(u => logs[u.id]?.handbook_written);
    const handbookCount = handbookDoneUsers.length;
    // Only show students in Review if they are missing AND haven't written handbook
    const missingCount = missingTotal.filter(u => !logs[u.id]?.handbook_written).length;
    // Done = submitted + absent + handbook-confirmed
    const doneCount = submittedCount + absentCount + handbookCount;

    const renderCard = (user: UserWithCoins) => {
        const log = logs[user.id] || { status: 'todo' };
        const isYellow = log.status === 'missing' && log.handbook_written;
        
        return (
            <div
                key={user.id}
                onClick={() => handleStudentClick(user)}
                className={`
                    relative p-2 rounded-xl border shadow-sm flex items-center gap-2 w-[120px] cursor-pointer hover:shadow-md transition-all active:scale-95
                    ${log.status === 'todo' ? 'bg-white border-slate-200' : ''}
                    ${log.status === 'submitted' ? 'bg-green-50 border-green-200 text-green-800' : ''}
                    ${log.status === 'absent' ? 'bg-slate-100 border-slate-300 text-slate-500' : ''}
                    ${log.status === 'missing' && !isYellow ? 'bg-red-50 border-red-200 text-red-800' : ''}
                    ${isYellow ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : ''}
                `}
            >
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate leading-tight">
                        {user.display_name}({user.class_number || '-'})
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-tight opacity-70">
                        {log.status === 'missing' ? (isYellow ? 'Handbook' : 'Missing') : log.status}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className={`flex gap-6 w-full ${isPipView ? 'flex-row h-full p-4' : 'flex-col lg:flex-row'}`}>
            {/* LEFT PANE: Console */}
            <div className={`${isPipView ? 'w-[280px] min-w-[280px] overflow-y-auto pr-2' : 'lg:w-1/3'} flex flex-col gap-4`}>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col items-center">
                    <div className="text-4xl font-black text-slate-800 tabular-nums tracking-tight">
                        {displayTime}
                    </div>
                    <div className="text-sm font-medium text-slate-500 mt-1">{displayTimeOverride ? 'Test Time' : 'HK Time'}</div>
                    
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl w-full text-center">
                        <h3 className="font-bold text-blue-800">Current Stage</h3>
                        <p className="text-sm text-blue-600 mt-1 whitespace-pre-wrap">
                            {stageTextOverride || (displayTime < '08:30' ? '早會前準備' : displayTime < '08:35' ? '早會進行中' : '早會結束')}
                        </p>
                    </div>

                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                        <div className="text-2xl font-black text-slate-700">{todoCount}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Todo</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                        <div className="text-2xl font-black text-green-600">{submittedCount}</div>
                        <div className="text-[10px] font-bold text-green-600 uppercase">Submitted</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                        <div className="text-2xl font-black text-red-600">{missingCount} <span className="text-sm text-yellow-500">({handbookCount})</span></div>
                        <div className="text-[10px] font-bold text-red-600 uppercase">Missing (H/B)</div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                        <div className="text-2xl font-black text-slate-500">{absentCount}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Absent</div>
                    </div>
                </div>
                
                <button 
                    onClick={handleConfirmStage}
                    className="w-full py-4 bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white font-bold rounded-2xl shadow-md transition-all active:scale-95 text-lg"
                >
                    Confirm Stage (Leader)
                </button>
            </div>

            {/* RIGHT PANE: Roster */}
            <div className={`${isPipView ? 'flex-1 overflow-auto' : 'lg:w-2/3'} bg-white p-6 rounded-2xl border border-slate-200 shadow-sm`}>
                <div className={`grid grid-cols-3 gap-6 ${isPipView ? 'min-w-[500px] h-max' : ''}`}>
                    {/* Todo Column */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-700 flex justify-between border-b pb-2">
                            <span>Todo</span>
                            <span className="text-slate-400">{todoCount}</span>
                        </h3>
                        <div className="flex flex-col gap-2 overflow-y-auto max-h-[360px] pr-2">
                            {users.filter(u => (logs[u.id]?.status || 'todo') === 'todo').map(renderCard)}
                        </div>
                    </div>
                    {/* Review Column */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-red-700 flex justify-between border-b pb-2 border-red-200">
                            <span>Review</span>
                            <span className="text-red-400">{missingCount}</span>
                        </h3>
                        <div className="flex flex-col gap-2 overflow-y-auto max-h-[360px] pr-2">
                            {/* Only show missing students who have NOT yet confirmed handbook */}
                            {users.filter(u => logs[u.id]?.status === 'missing' && !logs[u.id]?.handbook_written).map(renderCard)}
                        </div>
                    </div>
                    {/* Done Column */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-green-700 flex justify-between border-b pb-2 border-green-200">
                            <span>Done</span>
                            <span className="text-green-400">{doneCount}</span>
                        </h3>
                        <div className="flex flex-col gap-2 overflow-y-auto max-h-[360px] pr-2">
                            {/* submitted, absent, AND missing+handbook_written all count as Done */}
                            {users.filter(u =>
                                logs[u.id]?.status === 'submitted' ||
                                logs[u.id]?.status === 'absent' ||
                                (logs[u.id]?.status === 'missing' && logs[u.id]?.handbook_written)
                            ).map(renderCard)}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {showChoiceModal && selectedStudent && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">{selectedStudent.display_name}</h2>
                            <button onClick={() => setShowChoiceModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><AlertTriangle size={20}/></button>
                        </div>
                        <div className="grid gap-3">
                            <button onClick={() => selectChoice('submitted')} className="p-4 bg-green-50 text-green-700 rounded-xl font-bold border border-green-200 hover:bg-green-100 flex items-center gap-3">
                                <CheckCircle2 /> 交齊功課 (Submitted)
                            </button>
                            <button onClick={() => selectChoice('missing')} className="p-4 bg-red-50 text-red-700 rounded-xl font-bold border border-red-200 hover:bg-red-100 flex items-center gap-3">
                                <AlertCircle /> 欠功課 (Missing)
                            </button>
                            <button onClick={() => selectChoice('absent')} className="p-4 bg-slate-100 text-slate-600 rounded-xl font-bold border border-slate-200 hover:bg-slate-200 flex items-center gap-3">
                                <UserX /> 缺席 (Absent)
                            </button>

                            {logs[selectedStudent.id]?.status === 'missing' && !logs[selectedStudent.id]?.handbook_written && (
                                <button onClick={() => setShowPinModal(true)} className="mt-4 p-4 bg-yellow-50 text-yellow-700 rounded-xl font-bold border border-yellow-300 hover:bg-yellow-100 flex items-center gap-3">
                                    <BookOpen /> 已寫手冊 (Handbook Written)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showOverwriteModal && pendingChoice && selectedStudent && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                        <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2"><AlertTriangle/> 覆蓋警告</h2>
                        <p className="text-slate-700 mb-6 font-medium">
                            已有紀錄：<span className="font-bold text-slate-900">{logs[selectedStudent.id]?.status}</span> — 確定改做 <span className="font-bold text-slate-900">{pendingChoice}</span>？
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowOverwriteModal(false)} className="flex-1 p-3 bg-slate-100 text-slate-700 rounded-xl font-bold">Cancel</button>
                            <button onClick={() => processChoice(pendingChoice)} className="flex-1 p-3 bg-red-600 text-white rounded-xl font-bold">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {showMissingFlow && selectedStudent && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="mb-4 pb-4 border-b">
                            <h2 className={`text-2xl font-black ${isSetupMode ? 'text-blue-600' : 'text-red-600'}`}>
                                {isSetupMode ? '設定今日要交嘅功課 (Setup Today\'s HW)' : `欠功課 - ${selectedStudent.display_name}`}
                            </h2>
                            {isSetupMode && <p className="text-sm text-slate-500 font-bold mt-1 uppercase">NOT what you are missing</p>}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto min-h-[300px] mb-4">
                            {Object.entries(isSetupMode ? homeworkOptions : (dailyHomeworkMap[activeClass] || {})).map(([subject, items]) => (
                                <div key={subject} className="mb-4">
                                    <h4 className="font-bold text-slate-700 mb-2">{subject}</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {items.map(item => {
                                            const isSelected = (missingItems[subject] || []).includes(item);
                                            return (
                                                <button
                                                    key={item}
                                                    onClick={() => {
                                                        const current = missingItems[subject] || [];
                                                        setMissingItems(prev => ({
                                                            ...prev,
                                                            [subject]: isSelected ? current.filter(i => i !== item) : [...current, item]
                                                        }));
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${isSelected ? (isSetupMode ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-red-100 border-red-400 text-red-700') : 'bg-white border-slate-200 text-slate-600'}`}
                                                >
                                                    {item}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-4 border-t">
                            <button onClick={() => setShowMissingFlow(false)} className="flex-1 p-3 bg-slate-100 rounded-xl font-bold">Cancel</button>
                            <button onClick={handleMissingConfirm} className={`flex-1 p-3 rounded-xl font-bold text-white ${isSetupMode ? 'bg-blue-600' : 'bg-red-600'}`}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {showPinModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center">
                        <Lock className="mx-auto text-yellow-500 mb-4" size={32} />
                        <h2 className="text-xl font-bold text-white mb-2">Teacher PIN</h2>
                        <input
                            type="password"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            className="w-full text-center text-2xl tracking-widest p-3 bg-slate-800 text-white rounded-xl mb-4 border border-slate-700 focus:border-yellow-500 focus:outline-none"
                            autoFocus
                        />
                        {pinError && <p className="text-red-400 text-sm mb-4 font-medium">{pinError}</p>}
                        
                        {isLockedOut ? (
                            <button onClick={() => { setShowPinModal(false); setShowUnlockModal(true); }} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold flex justify-center items-center gap-2"><Unlock size={18}/> Unlock via Password</button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => setShowPinModal(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold">Cancel</button>
                                <button onClick={submitPin} className="flex-1 py-3 bg-yellow-500 text-slate-900 rounded-xl font-bold">Verify</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showUnlockModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-red-950 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-red-800">
                        <Unlock className="mx-auto text-red-500 mb-4" size={48} />
                        <h2 className="text-xl font-black text-white mb-2 text-center">Admin Unlock Required</h2>
                        <p className="text-red-300 text-sm text-center mb-6">Too many failed PIN attempts. Enter your login password to unlock.</p>
                        <input
                            type="password"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            className="w-full p-3 bg-black/50 text-white rounded-xl mb-4 border border-red-800 focus:border-red-500 focus:outline-none"
                            placeholder="Your login password"
                        />
                        {pinError && <p className="text-red-400 text-sm mb-4 font-medium">{pinError}</p>}
                        <div className="flex gap-2">
                            <button onClick={() => setShowUnlockModal(false)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold">Cancel</button>
                            <button onClick={submitUnlock} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Unlock</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Toast Notification at bottom */}
            {toastMessage && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in">
                    <div className={`px-6 py-3 rounded-full shadow-lg font-bold flex items-center gap-2 ${
                        toastMessage.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                        {toastMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                        {toastMessage.text}
                    </div>
                </div>
            )}
        </div>
    );
};
