import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Send, Settings2, X, Zap, Megaphone, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BROADCAST_SOURCE } from '@/constants/broadcastConfig';
import { useDashboardTheme } from '@/context/DashboardThemeContext';
import { getHKTodayString } from '@/utils/dateUtils';
import { MISSING_HOMEWORK_TITLES } from '@/constants/rewardConfig';

interface BroadcastQuickBarProps {
    selectedCount: number;
    className: string; // The active class name for filtering
    onClearSelection: () => void;
    onOpenManage: () => void;
    onOpenLiveBoard: () => void;
    onOpenBroadcast: () => void;
    onRefresh: () => void;
}

const ITEM_HEIGHT_PX = 80;

const formatHKDate = (dateStr: string) => {
    try {
        if (!dateStr) return '';
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Hong_Kong",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date(dateStr));
    } catch (e) {
        return '';
    }
};

export const BroadcastQuickBar: React.FC<BroadcastQuickBarProps> = ({
    selectedCount,
    className,
    onClearSelection,
    onOpenManage,
    onOpenLiveBoard,
    onOpenBroadcast,
    onRefresh
}) => {
    const navigate = useNavigate();
    const { theme } = useDashboardTheme();
    const [messages, setMessages] = useState<any[]>([]);
    const [pages, setPages] = useState<any[]>([]);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [containerWidth, setContainerWidth] = useState(0);

    const [activeIndex, setActiveIndex] = useState(0);
    const activePageKeyRef = useRef<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const [disableTransition, setDisableTransition] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Track container width for pagination
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                setContainerWidth(entries[0].contentRect.width);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Pagination logic
    useLayoutEffect(() => {
        if (messages.length === 0) {
            setPages([]);
            return;
        }

        const newPages: any[] = [];
        messages.forEach(msg => {
            const textEl = document.getElementById(`measure-text-${msg.groupId}`);
            if (!textEl) {
                newPages.push({ ...msg, titleChunk: msg.title, pageIndex: 0, totalPages: 1, pageKey: `${(msg.id ?? msg.groupId)}:0` });
                return;
            }

            const computedStyle = window.getComputedStyle(textEl);
            let lineHeight = parseInt(computedStyle.lineHeight);
            if (isNaN(lineHeight)) {
                const fontSize = parseInt(computedStyle.fontSize) || 16;
                lineHeight = Math.round(fontSize * 1.5);
            }
            // Max height is now 2 lines because Date takes up Line 1
            const maxHeight = lineHeight * 2;

            let remaining = (msg.title || '').trim();
            const chunks: string[] = [];
            
            if (remaining.length === 0) {
                chunks.push('');
            } else {
                while (remaining.length > 0) {
                    textEl.textContent = remaining;
                    if (textEl.offsetHeight <= maxHeight) {
                        chunks.push(remaining);
                        break;
                    }
                    
                    let low = 0;
                    let high = remaining.length;
                    let best = 0;
                    while (low <= high) {
                        const mid = Math.floor((low + high) / 2);
                        textEl.textContent = remaining.substring(0, mid) + '...';
                        if (textEl.offsetHeight <= maxHeight) {
                            best = mid;
                            low = mid + 1;
                        } else {
                            high = mid - 1;
                        }
                    }
                    
                    let breakIdx = best;
                    const chunk = remaining.substring(0, best);
                    const lastNewline = chunk.lastIndexOf('\n');
                    const lastSpace = chunk.lastIndexOf(' ');
                    
                    if (lastNewline > 0) breakIdx = lastNewline;
                    else if (lastSpace > 0) breakIdx = lastSpace;
                    
                    if (breakIdx === 0) breakIdx = best;
                    if (breakIdx < 10 && remaining.length > 10) {
                        breakIdx = 10;
                    }
                    
                    chunks.push(remaining.substring(0, breakIdx).trim());
                    remaining = remaining.substring(breakIdx).trim();
                }
            }

            chunks.forEach((chunk, i) => {
                newPages.push({
                    ...msg,
                    titleChunk: chunk,
                    pageIndex: i,
                    totalPages: chunks.length,
                    pageKey: `${(msg.id ?? msg.groupId)}:${i}`
                });
            });
        });
        
        console.log('[DEBUG-MissingHW] Final Pagination - Pages Count:', newPages.length);
        setPages(newPages);
    }, [messages, containerWidth, theme.broadcastFontSize]);

    // Sync activeIndex and activePageKeyRef when pages change
    useEffect(() => {
        if (pages.length === 0) {
            setActiveIndex(0);
            activePageKeyRef.current = null;
            return;
        }

        setActiveIndex(prev => {
            const targetKey = activePageKeyRef.current;
            let nextIndex = 0;
            if (targetKey) {
                const foundIndex = pages.findIndex(p => p.pageKey === targetKey);
                if (foundIndex !== -1) {
                    nextIndex = foundIndex;
                } else {
                    nextIndex = Math.min(prev, pages.length - 1);
                }
            } else {
                nextIndex = Math.min(prev, pages.length - 1);
            }
            if (nextIndex < 0) nextIndex = 0;
            activePageKeyRef.current = pages[nextIndex]?.pageKey || null;
            return nextIndex;
        });
    }, [pages]);

    // Reset transition toggle when pages list size changes
    useEffect(() => {
        setDisableTransition(false);
    }, [pages.length]);

    // Safety timeout to reset transition disabled state after instant snap back to index 0
    useEffect(() => {
        if (disableTransition) {
            const timer = setTimeout(() => {
                setDisableTransition(false);
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [disableTransition]);

    // Timer and visibility management
    useEffect(() => {
        const stopTimer = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        const startTimer = () => {
            stopTimer(); // Always stop before starting to prevent stacking
            if (pages.length >= 2 && document.visibilityState === 'visible') {
                intervalRef.current = setInterval(() => {
                    setActiveIndex(prev => {
                        let current = prev;
                        if (current >= pages.length) {
                            current = 0; // Safety fallback
                        }
                        const next = current + 1;
                        const page = pages[next % pages.length];
                        activePageKeyRef.current = page?.pageKey || null;
                        return next;
                    });
                }, 6000);
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                startTimer();
            } else {
                stopTimer();
            }
        };

        startTimer();

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopTimer();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [pages.length]);

    // Handle transition end to instantly reset activeIndex back to 0 when clone index is reached
    const handleTransitionEnd = (e: React.TransitionEvent) => {
        if (e.propertyName === 'transform' && activeIndex === pages.length) {
            setDisableTransition(true);
            setActiveIndex(0);
        }
    };

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

                if (displayTitle.startsWith('功課:') || MISSING_HOMEWORK_TITLES.includes(displayTitle)) return;
                
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

            // Fetch morning_duty_logs for all dates to build Missing Homework summary
            console.log('[DEBUG-MissingHW] Inputs - Class:', currentClassUpper, 'isAllClasses:', isAllClasses);

            let homeworkQuery = supabase
                .from('morning_duty_logs')
                .select('log_date, student_id, missing_items, student:users(display_name, class)')
                .not('missing_items', 'is', null)
                .order('log_date', { ascending: false });
            
            const { data: homeworkData, error: hwError } = await homeworkQuery;
            
            console.log('[DEBUG-MissingHW] Result - Error:', hwError, 'Data Length:', homeworkData?.length);

            if (homeworkData && homeworkData.length > 0) {
                // Filter by class manually since student is an inner relationship
                let filteredHomework = homeworkData;
                if (!isAllClasses) {
                    filteredHomework = homeworkData.filter((log: any) => 
                        log.student && log.student.class && log.student.class.toUpperCase() === currentClassUpper
                    );
                }
                
                // Filter out empty objects
                filteredHomework = filteredHomework.filter((log: any) => 
                    log.missing_items && Object.keys(log.missing_items).length > 0
                );

                if (filteredHomework.length > 0) {
                    // Group by date
                    const logsByDate: Record<string, any[]> = {};
                    filteredHomework.forEach((log: any) => {
                        if (!logsByDate[log.log_date]) logsByDate[log.log_date] = [];
                        logsByDate[log.log_date].push(log);
                    });

                    Object.entries(logsByDate).forEach(([dateStr, logsForDate]) => {
                        const lines = logsForDate.map((log: any) => {
                            const name = log.student?.display_name || 'Unknown';
                            const subjectParts = Object.entries(log.missing_items).map(([sub, items]) => {
                                return `${sub}—${(items as string[]).join(', ')}`;
                            });
                            return `• ${name}: ${subjectParts.join('; ')}`;
                        });
                        
                        const titleText = `Missing Homework (${dateStr})\n${lines.join('\n')}`;
                        
                        // We set createdAt to now but slightly offset so newer dates are sorted higher
                        const sortDate = new Date();
                        // Add some milliseconds to make newer dates sort slightly higher than older dates
                        sortDate.setMilliseconds(sortDate.getMilliseconds() + new Date(dateStr).getTime() % 100000);

                        groups[`synthetic_missing_homework_${dateStr}`] = {
                            groupId: `synthetic_missing_homework_${dateStr}`,
                            title: titleText,
                            students: [], // No action buttons
                            type: 'negative',
                            isWholeClass: false,
                            isMissingHomeworkSummary: true,
                            targetDate: dateStr,
                            createdAt: sortDate.toISOString()
                        };
                    });
                }
            }

            // Convert to array and sort by latest activity
            const sortedGroups = Object.values(groups).sort((a: any, b: any) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            console.log('[DEBUG-MissingHW] Final Messages Count for Render:', sortedGroups.length);
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

    const displayPages = pages.length >= 2 ? [...pages, { ...pages[0], pageKey: `${pages[0].pageKey}-clone` }] : pages;

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

                        <div ref={containerRef} className="relative h-20 overflow-hidden w-full">
                            {/* Hidden Measurement DOM (No line clamping) */}
                            <div className="absolute top-0 left-0 w-full invisible pointer-events-none opacity-0 z-[-1]" aria-hidden="true">
                                {messages.map((group) => (
                                    <div key={group.groupId} className="h-20 shrink-0 flex items-center gap-3 w-full">
                                        <div className={`p-1.5 rounded-lg shrink-0 w-[26px]`}></div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                            {group.createdAt && (
                                                <span className="text-[10px] leading-none shrink-0">Date</span>
                                            )}
                                            <p 
                                                id={`measure-text-${group.groupId}`}
                                                className="font-black text-slate-900 tracking-tight whitespace-pre-wrap min-w-0 w-full"
                                                style={{ fontSize: `${theme.broadcastFontSize || 16}px` }}
                                            ></p>
                                            <div className="flex flex-nowrap gap-1.5 w-full shrink-0">
                                                {group.isWholeClass && (
                                                    <button className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shrink-0">Mark as Completed</button>
                                                )}
                                                {group.students.map((s: any, si: number) => (
                                                    <button key={si} className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shrink-0">{s.name}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {pages.length > 0 ? (
                                <div 
                                    className={`flex flex-col w-full ${disableTransition ? '' : 'transition-transform duration-500 ease-in-out'}`}
                                    style={{ transform: `translateY(-${activeIndex * ITEM_HEIGHT_PX}px)` }}
                                    onTransitionEnd={handleTransitionEnd}
                                >
                                    {displayPages.map((page) => (
                                        <div 
                                            key={page.pageKey} 
                                            className="h-20 shrink-0 flex items-center gap-3 w-full animate-in fade-in duration-300"
                                        >
                                            <div className={`p-1.5 rounded-lg shrink-0 ${
                                                page.type === 'negative' ? 'bg-red-100 text-red-600' : 
                                                page.type === 'positive' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                                            }`}>
                                                <Zap size={14} fill="currentColor" />
                                            </div>
                                            
                                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                                {page.createdAt && (
                                                    <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 leading-none">
                                                        {formatHKDate(page.createdAt)}
                                                    </span>
                                                )}
                                                
                                                <p 
                                                    className={`font-black text-slate-900 tracking-tight whitespace-pre-wrap line-clamp-2 min-w-0 w-full ${page.isMissingHomeworkSummary ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
                                                    style={{ fontSize: `${theme.broadcastFontSize || 16}px` }}
                                                    data-theme-key="broadcastFontSize"
                                                    title={page.title}
                                                    onClick={() => {
                                                        if (page.isMissingHomeworkSummary) {
                                                            navigate(`/admin/homework-makeup?class=${className}&focusDate=${page.targetDate || getHKTodayString()}`);
                                                        }
                                                    }}
                                                >
                                                    {page.titleChunk}
                                                </p>

                                                {/* Student Tags After Message */}
                                                <div className="flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-none w-full shrink-0">
                                                    {page.isWholeClass && (
                                                        <button 
                                                            onClick={() => page.wholeClassRecordId && handleRemoveStudent(page.wholeClassRecordId, 'Whole Class', page.groupId.replace('-clone', ''))}
                                                            className="px-2 py-0.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-500 transition-all shadow-sm shrink-0"
                                                        >
                                                            Mark as Completed
                                                        </button>
                                                    )}
                                                    {page.students.map((s: any, si: number) => (
                                                        <button 
                                                            key={si} 
                                                            onClick={() => handleRemoveStudent(s.recordId, s.name, page.groupId.replace('-clone', ''))}
                                                            className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-all shadow-sm shrink-0"
                                                        >
                                                            {s.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : messages.length > 0 ? null : (
                                <div className="h-20 flex items-center">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic ml-1">
                                        No active announcements
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Actions & Status */}
                    <div className="flex items-center gap-2 relative">
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
