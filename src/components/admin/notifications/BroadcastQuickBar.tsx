import React, { useState, useEffect } from 'react';
import { Send, Settings2, X, Zap, Megaphone, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BROADCAST_SOURCE } from '@/constants/broadcastConfig';
import { useDashboardTheme } from '@/context/DashboardThemeContext';

interface BroadcastQuickBarProps {
    selectedCount: number;
    className: string; // The active class name for filtering
    onClearSelection: () => void;
    onOpenManage: () => void;
    onOpenLiveBoard: () => void;
    onOpenBroadcast: () => void;
    onRefresh: () => void;
}

export const BroadcastQuickBar: React.FC<BroadcastQuickBarProps> = ({
    selectedCount,
    className,
    onClearSelection,
    onOpenManage,
    onOpenLiveBoard,
    onOpenBroadcast,
    onRefresh
}) => {
    const { theme } = useDashboardTheme();
    const [messages, setMessages] = useState<any[]>([]);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const currentClassUpper = className.trim().toUpperCase();
    const isAllClasses = currentClassUpper === 'ALL';

    const stripCoinSuffix = (msg: string | null | undefined) => (msg || '').replace(/\s\([+-]?\d+\)$/, '');

    const fetchBroadcasts = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('student_records')
                .select('id, message, created_at, type, target_classes, student_id, broadcast_group_id, hidden_on_board, student:student_id(display_name, class)')
                .eq('record_type', 'broadcast')
                .eq('source', BROADCAST_SOURCE)
                .eq('is_trash', false)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            // Grouping logic (similar to BroadcastBoard)
            const groups: Record<string, any> = {};
            
            (data || []).forEach((r: any) => {
                // Filter by class visibility
                const targetClasses = (r.target_classes || []).map((c: string) => (c || '').trim().toUpperCase());
                let isVisible = false;
                
                if (isAllClasses) isVisible = true;
                else if (targetClasses.includes('ALL')) isVisible = true;
                else if (targetClasses.length > 0) {
                    isVisible = targetClasses.includes(currentClassUpper);
                } else if (!r.student_id) {
                    isVisible = true;
                } else {
                    const studentClass = (r.student?.class || '').trim().toUpperCase();
                    isVisible = studentClass === currentClassUpper || !studentClass;
                }

                if (!isVisible || r.hidden_on_board) return;

                const fullMsg = r.message || '';
                const strippedOfCoins = stripCoinSuffix(fullMsg);
                const strippedOfClasses = strippedOfCoins.split(' @@{')[0];
                let displayTitle = strippedOfClasses;
                
                if (displayTitle.includes(' ||{')) {
                    displayTitle = displayTitle.split(' ||{')[0].trim();
                } else {
                    displayTitle = displayTitle.trim();
                }

                if (displayTitle.startsWith('功課:')) return;
                
                const gId = r.broadcast_group_id || displayTitle;
                
                if (!groups[gId]) {
                    groups[gId] = { 
                        groupId: gId,
                        title: displayTitle, 
                        students: [], 
                        type: r.type,
                        isWholeClass: !r.student_id,
                        wholeClassRecordId: !r.student_id ? r.id : undefined,
                        createdAt: r.created_at
                    };
                }

                if (r.student?.display_name && r.student_id) {
                    if (!groups[gId].students.some((s: any) => s.name === r.student.display_name)) {
                        groups[gId].students.push({ 
                            name: r.student.display_name, 
                            recordId: r.id 
                        });
                    }
                }
            });

            // Convert to array and sort by latest activity
            const sortedGroups = Object.values(groups).sort((a: any, b: any) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            setMessages(sortedGroups);
            setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (err) {
            console.error('Error fetching integrated broadcasts:', err);
        }
    };

    const handleRemoveStudent = async (recordId: string, name: string, groupId: string) => {
        const isWholeClass = name === 'Whole Class' || name === 'Entire Class';
        if (!confirm(isWholeClass ? `Mark this broadcast as completed?` : `Completed the task? (${name})`)) return;

        try {
            const { error: hiddenError } = await supabase
                .from('student_records')
                .update({ hidden_on_board: true } as any)
                .eq('id', recordId);

            if (hiddenError) throw hiddenError;

            // Check if group is now fully hidden
            const { data: siblings, error: sibError } = await supabase
                .from('student_records')
                .select('id, hidden_on_board')
                .eq('broadcast_group_id', groupId)
                .is('is_trash', false);

            if (sibError) throw sibError;

            const allHidden = (siblings || []).every((s: any) => s.hidden_on_board);
            
            if (isWholeClass || (allHidden && siblings && siblings.length > 0)) {
                const { error: trashError } = await (supabase as any).rpc('trash_broadcast_group', { p_group_id: groupId });
                if (trashError) throw trashError;
            }

            fetchBroadcasts();
            onRefresh();
        } catch (err) {
            console.error('Removal failed:', err);
            alert('Failed to remove student from board.');
        }
    };

    useEffect(() => {
        fetchBroadcasts();

        const channel = (supabase as any)
            .channel('integrated-broadcast-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_records' }, () => {
                fetchBroadcasts();
                onRefresh();
            })
            .subscribe();

        return () => {
            (supabase as any).removeChannel(channel);
        };
    }, [className]);

    if (messages.length === 0 && selectedCount === 0) return null;

    return (
        <div className="sticky top-0 z-30 flex justify-center px-4 py-2 transition-all duration-500">
            <div 
                className={`relative w-full max-w-7xl overflow-hidden backdrop-blur-2xl border border-white/60 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl shadow-blue-500/10 transition-all group ${messages.length > 0 ? 'p-4 md:p-6' : 'p-2 md:p-3 opacity-60 hover:opacity-100'}`}
                style={{ 
                    backgroundColor: theme.broadcastBg,
                    color: theme.broadcastText
                }}
            >
                
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-blue-400/10 blur-[80px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-indigo-400/10 blur-[80px] rounded-full pointer-events-none" />

                <div className="relative flex flex-col md:flex-row items-center justify-between gap-4">
                    
                    {/* Left: Live Announcements Section */}
                    <div className="flex-1 flex flex-col gap-2 w-full md:w-auto">
                        <div className="flex items-center justify-between md:justify-start gap-4">
                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100/50">
                                <Megaphone size={14} className="animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Live Announcement</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums">
                                <Clock size={12} />
                                {lastUpdated}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            {messages.length > 0 ? (
                                messages.slice(0, 1).map((group) => (
                                    <div key={group.groupId} className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <div className={`p-1.5 rounded-lg ${
                                            group.type === 'negative' ? 'bg-red-100 text-red-600' : 
                                            group.type === 'positive' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                                        }`}>
                                            <Zap size={14} fill="currentColor" />
                                        </div>
                                        <p 
                                            className="font-black text-slate-900 tracking-tight"
                                            style={{ fontSize: `${theme.broadcastFontSize || 16}px` }}
                                            data-theme-key="broadcastFontSize"
                                        >
                                            {group.title}
                                        </p>

                                        {/* Student Tags */}
                                        <div className="flex flex-wrap gap-1.5 ml-2">
                                            {group.isWholeClass && (
                                                <button 
                                                    onClick={() => group.wholeClassRecordId && handleRemoveStudent(group.wholeClassRecordId, 'Whole Class', group.groupId)}
                                                    className="px-2 py-0.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-500 transition-all shadow-sm"
                                                >
                                                    Mark as Completed
                                                </button>
                                            )}
                                            {group.students.map((s: any, si: number) => (
                                                <button 
                                                    key={si} 
                                                    onClick={() => handleRemoveStudent(s.recordId, s.name, group.groupId)}
                                                    className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-all shadow-sm"
                                                >
                                                    {s.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic ml-1">
                                    No active announcements
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right: Actions & Status */}
                    <div className="flex items-center gap-2 relative">
                        {/* Status for Large Screens */}
                        {selectedCount === 0 && (
                            <div className="hidden lg:flex flex-col items-end px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-r border-slate-200 mr-2">
                                <span>Systems Online</span>
                                <span className="text-[8px] opacity-50">Broadcast v2.5</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                onClick={onOpenLiveBoard}
                                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                            >
                                History
                            </button>
                            
                            {/* Selection Overlay */}
                            <div className={`flex items-center gap-2 transition-all duration-500`}>
                                {selectedCount > 0 && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 font-black text-xs uppercase tracking-widest whitespace-nowrap animate-in slide-in-from-right-2">
                                        {selectedCount} Selected
                                    </div>
                                )}

                                <button
                                    onClick={onOpenBroadcast}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                                        selectedCount > 0 
                                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20' 
                                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
                                    }`}
                                >
                                    <Send size={14} />
                                    {selectedCount > 0 ? 'Broadcast' : 'Broadcast to Class'}
                                </button>

                                {selectedCount > 0 && (
                                    <button
                                        onClick={onClearSelection}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all animate-in slide-in-from-right-2"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>

                            {/* Manage Button - Always at Top Right of the bar container contextually */}
                            <button
                                onClick={onOpenManage}
                                className={`p-2 bg-white/60 text-slate-500 rounded-xl border border-white border-slate-200 hover:bg-white hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm group active:scale-95 ${selectedCount > 0 ? 'ml-2' : ''}`}
                                title="Manage Announcements"
                            >
                                <Settings2 size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
