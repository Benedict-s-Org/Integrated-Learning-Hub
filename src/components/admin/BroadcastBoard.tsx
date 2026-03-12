import React, { useState, useEffect } from 'react';
import { BookOpen, AlertCircle, X, Maximize2, Minimize2, Loader2, Calendar, Trophy, Zap, CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getHKTodayString, getHKTodayStartISO } from '@/utils/dateUtils';
import { SUBJECT_NAMES, MISSING_HOMEWORK_TITLES } from '@/constants/rewardConfig';

interface BroadcastBoardProps {
    onClose: () => void;
    className: string;
}

interface ActiveDisplayElement {
    title: string;
    students: { name: string }[];
    type: 'homework_record' | 'custom';
}
// Unused old interface removed

// Unused old interface removed


export const BroadcastBoard: React.FC<BroadcastBoardProps> = ({ onClose, className }) => {
    const today = getHKTodayString();
    const [assignments, setAssignments] = useState<Record<string, string>>({});
    const [missingHomework, setMissingHomework] = useState<{ name: string, items: string[] }[]>([]);
    const [recessAlert, setRecessAlert] = useState<string[]>([]);
    const [dynamicBroadcasts, setDynamicBroadcasts] = useState<ActiveDisplayElement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [activeOptionCount, setActiveOptionCount] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());

    useEffect(() => {
        fetchData();

        // Real-time subscription
        const channel = supabase
            .channel('broadcast-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_homework' }, () => {
                fetchData();
                setLastUpdated(new Date().toLocaleTimeString());
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_records' }, () => {
                fetchData();
                setLastUpdated(new Date().toLocaleTimeString());
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'system_config' }, () => {
                fetchData();
                setLastUpdated(new Date().toLocaleTimeString());
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [className]);

    const stripCoinSuffix = (msg: string | null | undefined) => (msg || '').replace(/\s\([+-]?\d+\)$/, '');

    const fetchData = async () => {
        console.log('BroadcastBoard: fetchData started', { className, today });
        try {
            let hwData: any = null;
            let configData: any = null;
            let recordData: any = null;
            let activeForClass: string[] = [];

            // 1. Fetch Homework
            const { data: directHwData } = await (supabase as any)
                .from('daily_homework')
                .select('assignments')
                .eq('date', today)
                .eq('class_name', className)
                .maybeSingle();
            hwData = directHwData;

            // 2. Fetch Broadcast Settings (Only for Presets now)
            const { data: directConfigData } = await (supabase as any)
                .from('system_config')
                .select('value')
                .eq('key', 'broadcast_v2_settings')
                .maybeSingle();
            configData = directConfigData;

            // 3. Fetch Records (Source of Truth for Announcements)
            const { data: directRecordData } = await (supabase as any)
                .from('student_records')
                .select('type, message, student_id, student:student_id(display_name, class)')
                .gte('created_at', getHKTodayStartISO());
            recordData = directRecordData;

            if (hwData) setAssignments(hwData.assignments);

            if (configData) {
                const settings = typeof configData.value === 'string' ? JSON.parse(configData.value) : configData.value;
                activeForClass = settings.active_options?.[className] || [];
                setActiveOptionCount(activeForClass.length);
            }

            let missing: { name: string, items: string[] }[] = [];
            let negativeCounts: Record<string, { name: string, count: number }> = {};
            let classRecords: any[] = [];

            if (recordData) {
                // Filter for current class WITH NORMALIZATION
                classRecords = recordData.filter((r: any) => {
                    const studentClass = (r.student?.class || '').trim().toUpperCase();
                    const current = (className || '').trim().toUpperCase();
                    return studentClass === current;
                });

                // A. Process Recess Alert (3+ negatives)
                classRecords.forEach((r: any) => {
                    if (r.type === 'negative') {
                        const name = r.student?.display_name || 'Unknown';
                        if (!negativeCounts[r.student_id]) negativeCounts[r.student_id] = { name, count: 0 };
                        negativeCounts[r.student_id].count++;
                    }
                });
                setRecessAlert(Object.values(negativeCounts).filter(s => s.count >= 3).map((s: any) => s.name));

                // B. Process Missing Homework if preset active
                if (activeForClass.includes('preset_missing_hw')) {
                    const missingMap: Record<string, { name: string, items: Set<string> }> = {};
                    classRecords.forEach((r: any) => {
                        const name = r.student?.display_name || 'Unknown';
                        const cleanMessage = stripCoinSuffix(r.message);

                        if (cleanMessage.startsWith('功課:')) {
                            const hwStr = cleanMessage.replace('功課:', '').trim();
                            if (!missingMap[r.student_id]) missingMap[r.student_id] = { name, items: new Set() };
                            missingMap[r.student_id].items.add(hwStr);
                        }
                        else if (MISSING_HOMEWORK_TITLES.includes(cleanMessage)) {
                            if (!missingMap[r.student_id]) missingMap[r.student_id] = { name, items: new Set() };
                            if (missingMap[r.student_id].items.size === 0) {
                                missingMap[r.student_id].items.add('Pending / 欠功課');
                            }
                        }
                    });

                    Object.values(missingMap).forEach(m => {
                        if (m.items.size > 1 && m.items.has('Pending / 欠功課')) {
                            m.items.delete('Pending / 欠功課');
                        }
                    });

                    missing = Object.values(missingMap).map(m => ({ name: m.name, items: Array.from(m.items) }));
                }
                setMissingHomework(missing);

                // C. Process Announcements (Grouped student_records)
                // Filter out records that are purely for homework status (unless they are also announcements)
                // For simplicity, we'll group EVERYTHING that isn't a specific individual homework item
                const announcementGroups: Record<string, { title: string, students: Set<string>, type: any }> = {};
                
                classRecords.forEach((r: any) => {
                    const fullMsg = stripCoinSuffix(r.message);
                    
                    let displayTitle = fullMsg;
                    let taggedNames: string[] = [];
                    let hasTagSuffix = false;
                    
                    // Check for our tagging metadata suffix: ||{Name1, Name2}
                    if (fullMsg.includes(' ||{')) {
                        const parts = fullMsg.split(' ||{');
                        displayTitle = parts[0];
                        taggedNames = (parts[1] || '').replace('}', '').split(', ').filter(Boolean);
                        hasTagSuffix = true;
                    }

                    // Skip if it's a specific homework item (starts with 功課:)
                    if (displayTitle.startsWith('功課:')) return;
                    
                    if (!announcementGroups[fullMsg]) {
                        announcementGroups[fullMsg] = { 
                            title: displayTitle, 
                            students: new Set(taggedNames), 
                            type: r.type === 'negative' ? 'homework_record' : 'custom'
                        };
                    }

                    // If NO suffix was found (Individual/Standard reward), accumulate student names from the join
                    if (!hasTagSuffix) {
                        announcementGroups[fullMsg].students.add(r.student?.display_name || 'Unknown');
                    }
                });

                // Convert to panels. Note: We now allow 0 students (general broadcast)
                const dynamicPanels: ActiveDisplayElement[] = Object.values(announcementGroups)
                    .map(group => ({
                        title: group.title,
                        students: Array.from(group.students).map(name => ({ name })),
                        type: group.type as 'homework_record' | 'custom'
                    }));

                setDynamicBroadcasts(dynamicPanels);
            } else {
                setRecessAlert([]);
                setMissingHomework([]);
                setDynamicBroadcasts([]);
            }

            console.log('BroadcastBoard Render Data:', {
                className,
                dynamicBroadcastsCount: dynamicBroadcasts.length,
                missingHomeworkCount: missing.length,
                recessAlertCount: Object.values(negativeCounts).filter(s => s.count >= 3).length
            });

        } catch (err) {
            console.error('Broadcast fetch failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullScreen(true);
        } else {
            document.exitFullscreen();
            setIsFullScreen(false);
        }
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest animate-pulse">Loading Broadcast Board...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`fixed inset-0 z-[100] bg-slate-900 text-white flex flex-col overflow-hidden animate-in fade-in duration-500 ${isFullScreen ? 'p-0' : 'p-4 md:p-8'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                        <Zap size={32} fill="white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter uppercase italic flex items-center gap-4">
                            {className} Broadcast
                            <span className="bg-slate-800 text-slate-400 text-sm font-bold px-3 py-1 rounded-full not-italic tracking-widest">
                                Live
                            </span>
                        </h1>
                        <p className="text-slate-500 font-bold flex items-center gap-2 mt-1 uppercase tracking-widest text-sm">
                            <Calendar size={16} />
                            {today}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={toggleFullScreen} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all shadow-lg text-slate-400">
                        {isFullScreen ? <Minimize2 /> : <Maximize2 />}
                    </button>
                    <button onClick={onClose} className="p-4 bg-red-600 hover:bg-red-700 rounded-2xl transition-all shadow-lg shadow-red-900/20">
                        <X />
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden min-h-0">
                {/* Left Side: Homework Assignments (2/3) */}
                <div className="lg:col-span-8 flex flex-col gap-6 overflow-hidden min-h-0">
                    <div className="bg-slate-800/50 rounded-[2.5rem] border border-slate-700 p-8 flex flex-col h-full shadow-2xl overflow-hidden min-h-0">
                        <div className="flex items-center justify-between mb-8 shrink-0">
                            <h2 className="text-3xl font-black uppercase italic text-blue-400 flex items-center gap-4">
                                <BookOpen size={36} />
                                Today's Assignments
                            </h2>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-4 scrollbar-hide">
                            {Object.values(SUBJECT_NAMES).map(subject => (
                                assignments[subject] ? (
                                    <div key={subject} className="bg-slate-800 p-8 rounded-[2rem] border-l-8 border-blue-500 shadow-xl transition-all hover:translate-x-2">
                                        <h3 className="text-xl font-black mb-4 text-blue-100 uppercase tracking-widest flex items-center justify-between">
                                            {subject}
                                            <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-[10px] tracking-[0.2em] font-black">Ready</span>
                                        </h3>
                                        <p className="text-2xl font-bold text-slate-200 leading-relaxed whitespace-pre-wrap">
                                            {assignments[subject]}
                                        </p>
                                    </div>
                                ) : null
                            ))}
                            {Object.keys(assignments).length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center text-slate-600 opacity-50 py-20">
                                    <BookOpen size={64} className="mb-4" />
                                    <p className="text-2xl font-black uppercase italic tracking-widest">No assignments posted yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Alerts and Records (1/3) */}
                <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-2 pb-8 scrollbar-hide">

                    {/* Recess Alert - always absolute top if exists */}
                    {recessAlert.length > 0 && (
                        <div className="bg-red-600 rounded-[2rem] p-6 shadow-2xl animate-pulse ring-8 ring-red-600/20 shrink-0">
                            <div className="flex items-center gap-4 mb-4">
                                <AlertCircle size={28} />
                                <h2 className="text-xl font-black uppercase italic tracking-tighter">Recess Board</h2>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {recessAlert.map(name => (
                                    <span key={name} className="bg-white text-red-600 px-3 py-1.5 rounded-xl font-black shadow-lg">
                                        {name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Missing Homework Ticker */}
                    {missingHomework.length > 0 && (
                        <div className="bg-orange-500 rounded-[2rem] p-6 flex flex-col shadow-2xl ring-4 ring-orange-500/10 shrink-0">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3 mt-1">
                                    <Trophy size={24} className="rotate-12" />
                                    Homework Check
                                </h2>
                                <span className="bg-white/20 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                    {missingHomework.length} Pending
                                </span>
                            </div>

                            <div className="flex flex-col gap-3">
                                {missingHomework.map((student, idx) => (
                                    <div key={idx} className="bg-white/10 p-4 rounded-xl flex flex-col gap-2 border border-white/5 transition-all">
                                        <div className="flex items-center justify-between">
                                            <span className="text-lg font-black">{student.name}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {student.items.map(item => (
                                                <span key={item} className="bg-white/90 text-orange-600 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dynamic Broadcast Panels */}
                    {dynamicBroadcasts.map((panel, idx) => (
                        <div key={idx} className="bg-blue-600 rounded-[2rem] p-6 flex flex-col shadow-2xl ring-4 ring-blue-600/10 shrink-0">
                            <div className="flex items-start gap-4 mb-4 border-b border-white/10 pb-4">
                                <MessageSquareWarning size={28} className="shrink-0 mt-1" />
                                <h2 className="text-lg font-bold leading-snug">{panel.title}</h2>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {panel.students.map((student, sid) => (
                                    <div key={sid} className="bg-white text-blue-800 px-4 py-2 rounded-xl border-b-4 border-slate-200">
                                        <span className="text-base font-black">{student.name}</span>
                                    </div>
                                ))}
                                {panel.students.length === 0 && (
                                    <div className="text-white/50 text-sm font-bold italic w-full text-center py-2">No students tagged</div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Empty State */}
                    {missingHomework.length === 0 && recessAlert.length === 0 && dynamicBroadcasts.length === 0 && (
                        <div className="bg-slate-800/30 rounded-[2rem] border-2 border-dashed border-slate-700 p-8 flex flex-col items-center justify-center text-slate-500 h-64 shrink-0">
                            <CheckCircle2 size={48} className="mb-4" />
                            <h2 className="text-xl font-black uppercase italic tracking-widest text-center">All Clear</h2>
                            <p className="font-bold mt-2">No critical alerts or records</p>
                        </div>
                    )}

                </div>
            </div>

            {/* Bottom Footer / Ticker */}
            <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between text-slate-500 italic shrink-0">
                <div className="flex flex-col gap-1">
                    <p className="font-bold flex items-center gap-2">
                        <span className="bg-blue-600 w-2 h-2 rounded-full animate-ping"></span>
                        Systems Nominal. Tracking {activeOptionCount} active broadcast options.
                    </p>
                    <p className="text-[10px] uppercase tracking-widest opacity-50 not-italic">
                        Last Signal: {lastUpdated}
                    </p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[.3em]">
                    <span>Precision</span>
                    <span>Performance</span>
                    <span>Knowledge</span>
                </div>
            </div>
        </div>
    );
};
