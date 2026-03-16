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

    const fetchBroadcasts = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('student_records')
                .select('id, message, created_at, type, target_classes, student:student_id(display_name, class)')
                .eq('record_type', 'broadcast')
                .eq('source', BROADCAST_SOURCE)
                .order('created_at', { ascending: false })
                .limit(3);

            if (error) throw error;

            // Filter by class visibility
            const visibleMessages = (data || []).filter((r: any) => {
                const targetClasses = (r.target_classes || []).map((c: string) => (c || '').trim().toUpperCase());
                if (isAllClasses) return true;
                if (targetClasses.includes('ALL')) return true;
                if (targetClasses.length > 0) {
                    return targetClasses.includes(currentClassUpper);
                }
                
                if (!r.student_id) return true;
                const studentClass = (r.student?.class || '').trim().toUpperCase();
                return studentClass === currentClassUpper || !studentClass;
            });

            // Strip suffixes for display
            setMessages(visibleMessages.map((m: any) => ({
                ...m,
                message: m.message ? m.message.split(' ||{')[0].split(' @@{')[0] : ''
            })));
            setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (err) {
            console.error('Error fetching integrated broadcasts:', err);
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

    return (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-2 animate-in fade-in slide-in-from-top-4 duration-500">
            <div 
                className="relative w-full max-w-7xl overflow-hidden backdrop-blur-2xl border border-white/60 p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl shadow-blue-500/10 transition-all group"
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
                                messages.slice(0, 1).map((msg) => (
                                    <div key={msg.id} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <div className={`p-1.5 rounded-lg ${
                                            msg.type === 'positive' ? 'bg-green-100 text-green-600' : 
                                            msg.type === 'negative' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                        }`}>
                                            <Zap size={14} fill="currentColor" />
                                        </div>
                                        <p 
                                            className="font-black text-slate-900 tracking-tight line-clamp-1"
                                            style={{ fontSize: `${theme.broadcastFontSize || 16}px` }}
                                            data-theme-key="broadcastFontSize"
                                        >
                                            {msg.message}
                                        </p>
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
