import React, { useState, useEffect } from 'react';
import { AlertCircle, X, Maximize2, Minimize2, Loader2, Calendar, Trophy, Zap, CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getHKTodayString } from '@/utils/dateUtils';
import { MISSING_HOMEWORK_TITLES } from '@/constants/rewardConfig';
import { BROADCAST_SOURCE } from '@/constants/broadcastConfig';

interface BroadcastBoardProps {
    onClose: () => void;
    className: string;
}

interface ActiveDisplayElement {
    groupId: string;
    title: string;
    students: { name: string; recordId: string }[];
    type: 'homework_record' | 'custom';
    isWholeClass: boolean;
    wholeClassRecordId?: string;
}

export const BroadcastBoard: React.FC<BroadcastBoardProps> = ({ onClose, className }) => {
    const today = getHKTodayString();
    const [missingHomework, setMissingHomework] = useState<{ name: string, items: string[] }[]>([]);
    const [recessAlert, setRecessAlert] = useState<string[]>([]);
    const [dynamicBroadcasts, setDynamicBroadcasts] = useState<ActiveDisplayElement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [activeOptionCount, setActiveOptionCount] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());
    const [activeForClass, setActiveForClass] = useState<string[]>([]);

    const currentClassUpper = className.trim().toUpperCase();
    const isAllClasses = currentClassUpper === 'ALL';

    useEffect(() => {
        fetchData();

        // Real-time subscription
        const channel = (supabase as any)
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
            (supabase as any).removeChannel(channel);
        };
    }, [className]);

    const stripCoinSuffix = (msg: string | null | undefined) => (msg || '').replace(/\s\([+-]?\d+\)$/, '');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            let recordData: any = null;
            let currentActiveForClass: string[] = [];

            // 1. Fetch Homework
            await (supabase as any)
                .from('daily_homework')
                .select('assignments')
                .eq('date', today)
                .eq('class_name', className)
                .maybeSingle();

            // 2. Fetch Broadcast Settings
            const { data: directConfigData } = await (supabase as any)
                .from('system_config')
                .select('value')
                .eq('key', 'broadcast_v2_settings')
                .maybeSingle();

            // 3. Fetch Records
            const { data: directRecordData, error: recordError } = await (supabase as any)
                .from('student_records')
                .select('id, type, message, created_at, student_id, record_type, source, target_classes, broadcast_group_id, hidden_on_board, is_trash, student:student_id(display_name, class)')
                .eq('record_type', 'broadcast')
                .eq('source', BROADCAST_SOURCE)
                .eq('is_trash', false)
                .order('created_at', { ascending: false })
                .limit(200);

            if (recordError) throw recordError;
            recordData = directRecordData || [];

            if (directConfigData) {
                const settings = typeof directConfigData.value === 'string' ? JSON.parse(directConfigData.value) : directConfigData.value;
                currentActiveForClass = settings.active_options?.[className] || [];
                setActiveForClass(currentActiveForClass);
                setActiveOptionCount(currentActiveForClass.length);
            }

            let missing: { name: string, items: string[] }[] = [];
            let negativeCounts: Record<string, { name: string, count: number }> = {};

            const getRecordVisibilityInfo = (r: any) => {
                const targetClasses = (r.target_classes || []).map((c: string) => (c || '').trim().toUpperCase());
                if (isAllClasses) return { visible: true };
                if (targetClasses.includes('ALL')) return { visible: true };
                if (targetClasses.length > 0) {
                    return { visible: targetClasses.includes(currentClassUpper) };
                }
                const msg = r.message || '';
                const classMatch = msg.match(/\s@@\{([^}]*)\}/);
                if (classMatch) {
                    const legacyTargets = classMatch[1].split(', ').map((c: string) => c.trim().toUpperCase());
                    return { visible: legacyTargets.includes(currentClassUpper) || legacyTargets.includes('ALL') };
                }
                if (!r.student_id) return { visible: true };
                const studentClass = (r.student?.class || '').trim().toUpperCase();
                return { visible: studentClass === currentClassUpper || !studentClass };
            };

            // Process Recess Alert
            recordData.forEach((r: any) => {
                const { visible } = getRecordVisibilityInfo(r);
                if (visible && r.type === 'negative' && r.student_id) {
                    const name = r.student?.display_name || 'Unknown student';
                    if (!negativeCounts[r.student_id]) negativeCounts[r.student_id] = { name, count: 0 };
                    negativeCounts[r.student_id].count++;
                }
            });
            setRecessAlert(Object.values(negativeCounts).filter(s => s.count >= 3).map((s: any) => s.name));

            // Process Missing Homework
            if (currentActiveForClass.includes('preset_missing_hw') || isAllClasses) {
                const missingMap: Record<string, { name: string, items: Set<string> }> = {};
                recordData.forEach((r: any) => {
                    if (!r.student_id) return;
                    const { visible } = getRecordVisibilityInfo(r);
                    if (!visible) return;
                    const name = r.student?.display_name || 'Unknown student';
                    const cleanMessage = stripCoinSuffix(r.message);
                    if (cleanMessage.startsWith('功課:')) {
                        const hwStr = cleanMessage.replace('功課:', '').trim();
                        if (!missingMap[r.student_id]) missingMap[r.student_id] = { name, items: new Set() };
                        missingMap[r.student_id].items.add(hwStr);
                    } else if (MISSING_HOMEWORK_TITLES.includes(cleanMessage)) {
                        if (!missingMap[r.student_id]) missingMap[r.student_id] = { name, items: new Set() };
                        if (missingMap[r.student_id].items.size === 0) missingMap[r.student_id].items.add('Pending / 欠功課');
                    }
                });
                Object.values(missingMap).forEach(m => {
                    if (m.items.size > 1 && m.items.has('Pending / 欠功課')) m.items.delete('Pending / 欠功課');
                });
                missing = Object.values(missingMap).map(m => ({ name: m.name, items: Array.from(m.items) }));
            }
            setMissingHomework(missing);

            // Process Announcements
            const announcementGroups: Record<string, { 
                groupId: string, 
                title: string, 
                students: { name: string, recordId: string }[], 
                type: any,
                isWholeClass: boolean,
                wholeClassRecordId?: string
            }> = {};
            
            recordData.forEach((r: any) => {
                const { visible } = getRecordVisibilityInfo(r);
                if (!visible || r.hidden_on_board) return;

                const fullMsg = r.message || '';
                const strippedOfCoins = stripCoinSuffix(fullMsg);
                const strippedOfClasses = strippedOfCoins.split(' @@{')[0];
                let displayTitle = strippedOfClasses;
                let taggedNames: string[] = [];
                
                if (displayTitle.includes(' ||{')) {
                    try {
                        const parts = displayTitle.split(' ||{');
                        displayTitle = parts[0].trim();
                        taggedNames = (parts[1] || '').replace('}', '').split(', ').filter(Boolean);
                    } catch (err) {}
                } else {
                    displayTitle = displayTitle.trim();
                }

                if (displayTitle.startsWith('功課:')) return;
                
                const gId = r.broadcast_group_id || displayTitle; // Fallback to title for legacy
                
                if (!announcementGroups[gId]) {
                    announcementGroups[gId] = { 
                        groupId: gId,
                        title: displayTitle, 
                        students: [], 
                        type: r.type === 'negative' ? 'homework_record' : 'custom',
                        isWholeClass: !r.student_id,
                        wholeClassRecordId: !r.student_id ? r.id : undefined
                    };

                    // Add legacy tagged names if any (they won't have record IDs)
                    taggedNames.forEach(name => {
                        announcementGroups[gId].students.push({ name, recordId: 'legacy' });
                    });
                }

                if (r.student?.display_name && r.student_id) {
                    // Check if student already added from legacy names to avoid duplicates
                    if (!announcementGroups[gId].students.some(s => s.name === r.student.display_name)) {
                        announcementGroups[gId].students.push({ 
                            name: r.student.display_name, 
                            recordId: r.id 
                        });
                    } else {
                        // Update existing entry with real recordId if it was added as 'legacy'
                        const idx = announcementGroups[gId].students.findIndex(s => s.name === r.student.display_name);
                        if (idx !== -1 && announcementGroups[gId].students[idx].recordId === 'legacy') {
                            announcementGroups[gId].students[idx].recordId = r.id;
                        }
                    }
                }
                
                // Ensure wholeClassRecordId is set if it's a whole class broadcast
                if (!r.student_id && !announcementGroups[gId].wholeClassRecordId) {
                    announcementGroups[gId].wholeClassRecordId = r.id;
                }
            });

            setDynamicBroadcasts(Object.values(announcementGroups).map(group => ({
                groupId: group.groupId,
                title: group.title,
                students: group.students,
                type: group.type as 'homework_record' | 'custom',
                isWholeClass: group.isWholeClass,
                wholeClassRecordId: group.wholeClassRecordId
            })));

        } catch (err) {
            console.error('Broadcast fetch failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveStudent = async (recordId: string, name: string, groupId: string) => {
        const isWholeClass = name === 'Whole Class' || name === 'Entire Class';
        if (!confirm(isWholeClass ? `Mark this broadcast as completed?` : `Completed the task? (${name})`)) return;

        try {
            // 1. Hide the specific student's record (or the single class-wide record)
            const { error: hiddenError } = await supabase
                .from('student_records')
                .update({ hidden_on_board: true } as any)
                .eq('id', recordId);

            if (hiddenError) throw hiddenError;

            // 2. Check if the whole group is now hidden
            const { data: siblings, error: sibError } = await supabase
                .from('student_records')
                .select('id, hidden_on_board')
                .eq('broadcast_group_id', groupId)
                .is('is_trash', false);

            if (sibError) throw sibError;

            const allHidden = (siblings || []).every((s: any) => s.hidden_on_board);
            
            if (isWholeClass || (allHidden && siblings && siblings.length > 0)) {
                // Move whole group to trash
                const { error: trashError } = await (supabase as any).rpc('trash_broadcast_group', { p_group_id: groupId });
                if (trashError) throw trashError;
            }

            fetchData();
        } catch (err) {
            console.error('Removal failed:', err);
            alert('Failed to remove student from board.');
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

    return (
        <div className={`fixed inset-0 z-50 overflow-hidden flex flex-col transition-all duration-700 ${isFullScreen ? 'bg-slate-950 p-6' : 'bg-slate-900/40 backdrop-blur-3xl p-4 md:p-8'}`}>
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse [animation-delay:2s]" />
            </div>

            <div className="relative z-10 flex flex-col h-full max-w-7xl mx-auto w-full">
                <div className="flex items-center justify-between mb-8 shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="p-3 bg-blue-600 rounded-[1.5rem] shadow-lg shadow-blue-500/30 animate-bounce">
                            <Zap size={28} className="text-white fill-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic">Broadcast Board</h1>
                                <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-blue-500/20">Live</span>
                            </div>
                            <div className="flex items-center gap-4 text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">
                                <span className="flex items-center gap-1.5"><Calendar size={14} /> {today}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                <span>Class {className} System</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={fetchData} className="p-3 bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all border border-slate-700/50 group" title="Sync Data">
                            <Loader2 size={24} className={isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                        </button>
                        <button onClick={toggleFullScreen} className="p-3 bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all border border-slate-700/50" title="Toggle Fullscreen">
                            {isFullScreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                        </button>
                        <button onClick={onClose} className="p-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl transition-all border border-red-500/20 shadow-lg shadow-red-500/5" title="Close Board">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <div className="lg:col-span-8 flex flex-col gap-6">
                            {dynamicBroadcasts.length === 0 && missingHomework.length === 0 && recessAlert.length === 0 && (
                                <div className="h-full flex items-center justify-center py-20">
                                    <div className="flex flex-col items-center gap-6 animate-pulse">
                                        <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center">
                                            <CheckCircle2 size={48} className="text-slate-600" />
                                        </div>
                                        <div className="text-center">
                                            <h2 className="text-2xl font-black text-slate-500 uppercase italic tracking-widest mb-2">Systems Clear</h2>
                                            <p className="text-slate-600 font-bold">No active broadcast signals detected</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {dynamicBroadcasts.map((panel, idx) => (
                                <div key={idx} className={`relative overflow-hidden group rounded-[2.5rem] border-2 p-8 transition-all duration-500 hover:-translate-y-1 ${panel.type === 'homework_record' ? 'bg-orange-600/5 border-orange-500/20 hover:border-orange-500/40' : 'bg-blue-600/5 border-blue-500/10 hover:border-blue-500/30'}`}>
                                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                                        {panel.type === 'homework_record' ? <MessageSquareWarning size={80} /> : <Trophy size={80} />}
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${panel.type === 'homework_record' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'}`}>
                                                {panel.type === 'homework_record' ? 'Action Required' : 'Announcement'}
                                            </span>
                                            {panel.students.length > 0 && panel.students.some(s => s.name) && (
                                                <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{panel.students.length} Student{panel.students.length > 1 ? 's' : ''} Tagged</span>
                                            )}
                                        </div>
                                        <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight leading-tight">{panel.title}</h2>
                                        
                                        {/* Whole Class "Complete" button */}
                                        {panel.isWholeClass && (
                                            <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                                                <button 
                                                    onClick={() => panel.wholeClassRecordId && handleRemoveStudent(panel.wholeClassRecordId, 'Whole Class', panel.groupId)}
                                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black text-lg shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                                                >
                                                    Mark as Completed
                                                </button>
                                            </div>
                                        )}

                                        {panel.students.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                                                {panel.students.map((s, si) => (
                                                    <button 
                                                        key={si} 
                                                        onClick={() => s.recordId !== 'legacy' && handleRemoveStudent(s.recordId, s.name, panel.groupId)}
                                                        className={`px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-lg shadow-sm transition-all ${s.recordId !== 'legacy' ? 'hover:bg-white/20 hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default opacity-80'}`}
                                                    >
                                                        {s.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="lg:col-span-4 flex flex-col gap-6">
                            {(activeForClass.includes('preset_missing_hw') || isAllClasses) && missingHomework.length > 0 && (
                                <div className="bg-red-600/5 border-2 border-red-500/20 rounded-[2.5rem] p-8 overflow-hidden relative group">
                                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                                        <AlertCircle size={60} />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-red-600 rounded-xl shadow-lg shadow-red-500/20">
                                                <AlertCircle size={20} className="text-white" />
                                            </div>
                                            <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Missing Records</h3>
                                        </div>
                                        <div className="space-y-6">
                                            {missingHomework.map((student, idx) => (
                                                <div key={idx} className="flex flex-col gap-3 group/item">
                                                    <span className="text-white font-black text-2xl flex items-center gap-2 group-hover/item:text-red-400 transition-colors tracking-tight">
                                                        <span className="w-2 h-2 rounded-full bg-red-600" />
                                                        {student.name}
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5 pl-4">
                                                        {student.items.map((item, iidx) => (
                                                            <span key={iidx} className="px-3 py-1 bg-red-600/10 text-red-500 text-[10px] font-black rounded-lg uppercase tracking-wider border border-red-500/10">{item}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {recessAlert.length > 0 && (
                                <div className="bg-amber-600/5 border-2 border-amber-500/20 rounded-[2.5rem] p-8 overflow-hidden relative group">
                                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-6 transition-transform">
                                        <MessageSquareWarning size={60} />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-amber-600 rounded-xl shadow-lg shadow-amber-500/20">
                                                <MessageSquareWarning size={20} className="text-white" />
                                            </div>
                                            <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Recess Warning</h3>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {recessAlert.map((name, idx) => (
                                                <span key={idx} className="px-5 py-3 bg-amber-600/10 border border-amber-500/20 text-white font-black text-xl rounded-2xl shadow-sm hover:bg-amber-600/20 transition-all">{name}</span>
                                            ))}
                                        </div>
                                        <p className="mt-6 text-[10px] text-amber-500/60 uppercase font-black tracking-[0.2em] italic">High frequency penalty detected</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-slate-500 italic shrink-0">
                    <div className="flex flex-col gap-1">
                        <p className="font-bold flex items-center gap-2">
                            <span className="bg-blue-600 w-2 h-2 rounded-full animate-ping"></span>
                            Systems Nominal. Tracking {activeOptionCount} active configurations.
                        </p>
                        <p className="text-[10px] uppercase tracking-widest opacity-50 not-italic">
                            Last Signal: {lastUpdated}
                        </p>
                    </div>
                    <div className="hidden md:flex items-center gap-4 text-[10px] font-black uppercase tracking-[.3em]">
                        <span>Precision</span>
                        <span className="w-1 h-1 rounded-full bg-slate-800" />
                        <span>Performance</span>
                        <span className="w-1 h-1 rounded-full bg-slate-800" />
                        <span>Knowledge</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
