import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, ChevronDown, ChevronRight, Loader2, BookOpen, Clock, Calendar, CheckCircle2 } from 'lucide-react';

interface MissingItemLog {
    id: string;
    log_date: string;
    student_id: string;
    missing_items: Record<string, string[]>;
    student?: {
        display_name: string;
        class: string;
        class_number: string;
        username?: string;
    };
}

export const AdminHomeworkMakeupPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    const focusDate = searchParams.get('focusDate');
    const filterClass = searchParams.get('class');

    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<MissingItemLog[]>([]);
    const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set(focusDate ? [focusDate] : []));
    const [madeUpSet, setMadeUpSet] = useState<Set<string>>(new Set());
    const [loadingKey, setLoadingKey] = useState<string | null>(null);

    useEffect(() => {
        fetchMissingHomework();
    }, []);

    const fetchMissingHomework = async () => {
        setIsLoading(true);
        try {
            // Fetch all logs where missing_items is not null
            let query = supabase
                .from('morning_duty_logs')
                .select('id, log_date, student_id, missing_items, student:users(display_name, class, class_number, username)')
                .not('missing_items', 'is', null)
                .order('log_date', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;

            // We do class filtering on the client since student is an inner join object and sometimes we want ALL
            let filteredData = data || [];
            if (filterClass && filterClass.toUpperCase() !== 'ALL') {
                filteredData = filteredData.filter((log: any) => 
                    log.student && log.student.class && log.student.class.toUpperCase() === filterClass.toUpperCase()
                );
            }

            // Also filter out any logs where missing_items might be an empty object {}
            filteredData = filteredData.filter((log: any) => 
                log.missing_items && Object.keys(log.missing_items).length > 0
            );

            // Fetch made up actions
            const logIds = filteredData.map((l: any) => l.id);
            if (logIds.length > 0) {
                const { data: actionsData, error: actionsError } = await supabase
                    .from('homework_makeup_actions')
                    .select('log_id, subject, item, is_made_up')
                    .in('log_id', logIds);

                if (actionsError) {
                    console.error('Error fetching makeup actions:', actionsError);
                } else {
                    const newMadeUpSet = new Set<string>();
                    actionsData?.forEach(action => {
                        if (action.is_made_up) {
                            newMadeUpSet.add(`${action.log_id}::${action.subject}::${action.item}`);
                        }
                    });
                    setMadeUpSet(newMadeUpSet);
                }
            }

            setLogs(filteredData as any);
        } catch (err) {
            console.error('Error fetching missing homework logs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const groupedLogs = useMemo(() => {
        const groups: Record<string, MissingItemLog[]> = {};
        logs.forEach(log => {
            if (!groups[log.log_date]) {
                groups[log.log_date] = [];
            }
            groups[log.log_date].push(log);
        });
        
        // Sort dates descending
        return Object.entries(groups)
            .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
            .map(([date, items]) => {
                // Calculate item counts
                let totalItems = 0;
                items.forEach(item => {
                    Object.values(item.missing_items).forEach(arr => {
                        totalItems += arr.length;
                    });
                });

                // Sort students by class and then class_number
                const sortedItems = [...items].sort((a, b) => {
                    const classA = a.student?.class || '';
                    const classB = b.student?.class || '';
                    if (classA !== classB) return classA.localeCompare(classB);
                    const numA = parseInt(a.student?.class_number || '0');
                    const numB = parseInt(b.student?.class_number || '0');
                    return numA - numB;
                });

                return {
                    date,
                    studentCount: items.length,
                    itemCount: totalItems,
                    items: sortedItems
                };
            });
    }, [logs]);

    const toggleDate = (date: string) => {
        setExpandedDates(prev => {
            const next = new Set(prev);
            if (next.has(date)) {
                next.delete(date);
            } else {
                next.add(date);
            }
            return next;
        });
    };

    const toggleMakeup = async (logId: string, subject: string, item: string) => {
        const key = `${logId}::${subject}::${item}`;
        setLoadingKey(key);
        try {
            const { data, error } = await supabase.rpc('toggle_homework_makeup', {
                p_log_id: logId,
                p_subject: subject,
                p_item: item
            });

            if (error) throw error;

            setMadeUpSet(prev => {
                const next = new Set(prev);
                if (data.is_made_up) {
                    next.add(key);
                } else {
                    next.delete(key);
                }
                return next;
            });
        } catch (err) {
            console.error('Error toggling makeup:', err);
        } finally {
            setLoadingKey(null);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Intl.DateTimeFormat("en-HK", {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(new Date(dateStr));
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                            <AlertCircle size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800">Missing Homework Management</h1>
                            <p className="text-slate-500 font-medium">
                                Review student missing homework logs from Morning Duties
                                {filterClass && filterClass.toUpperCase() !== 'ALL' && ` • Filtered: Class ${filterClass.toUpperCase()}`}
                            </p>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors self-start md:self-auto"
                    >
                        Back to Dashboard
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 size={40} className="animate-spin text-blue-500" />
                        <p className="text-slate-500 font-bold">Loading records...</p>
                    </div>
                ) : groupedLogs.length === 0 ? (
                    <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                        <CheckCircle2 size={64} className="text-green-400 mb-4" />
                        <h2 className="text-2xl font-black text-slate-800 mb-2">All Clear!</h2>
                        <p className="text-slate-500 text-lg">No missing homework records found.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedLogs.map((group) => {
                            const isExpanded = expandedDates.has(group.date);

                            return (
                                <div key={group.date} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                    {/* Accordion Header */}
                                    <button 
                                        onClick={() => toggleDate(group.date)}
                                        className={`w-full flex items-center justify-between p-6 transition-colors hover:bg-slate-50 ${isExpanded ? 'bg-slate-50 border-b border-slate-100' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg transition-transform duration-300 ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-90' : 'bg-slate-100 text-slate-500'}`}>
                                                <ChevronRight size={20} />
                                            </div>
                                            <div className="text-left">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={18} className="text-slate-400" />
                                                    <h2 className="text-xl font-black text-slate-800">
                                                        {formatDate(group.date)}
                                                    </h2>
                                                    {group.date === focusDate && (
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                                                            Focused
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-wider">
                                                    {group.studentCount} Student{group.studentCount !== 1 ? 's' : ''} • {group.itemCount} Item{group.itemCount !== 1 ? 's' : ''} Missing
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Accordion Body */}
                                    {isExpanded && (
                                        <div className="p-6 bg-slate-50/50">
                                            <div className="grid grid-cols-1 gap-4">
                                                {group.items.map((log) => (
                                                    <div key={log.student_id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-start gap-4 hover:border-blue-200 hover:shadow-md transition-all">
                                                        
                                                        {/* Student Info */}
                                                        <div className="md:w-64 shrink-0 flex items-center gap-3">
                                                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-black text-lg border border-blue-100">
                                                                {log.student?.class}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-slate-800 text-lg flex items-center gap-2">
                                                                    {log.student?.display_name || 'Unknown'}
                                                                    <span className="text-xs font-bold text-slate-400">({log.student?.class_number})</span>
                                                                </div>
                                                                {log.student?.username && (
                                                                    <div className="text-sm text-slate-500 font-medium">@{log.student.username}</div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Missing Items */}
                                                        <div className="flex-1 flex flex-col gap-3 md:border-l md:border-slate-100 md:pl-6">
                                                            {Object.entries(log.missing_items).map(([subject, items]) => (
                                                                <div key={subject} className="flex flex-col gap-2">
                                                                    <div className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                                                                        <BookOpen size={14} className="text-slate-400" />
                                                                        {subject}
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {items.map((item, idx) => {
                                                                            const k = `${log.id}::${subject}::${item}`;
                                                                            const isMadeUp = madeUpSet.has(k);
                                                                            return (
                                                                                <button
                                                                                    key={item}
                                                                                    type="button"
                                                                                    disabled={loadingKey === k}
                                                                                    onClick={() => toggleMakeup(log.id, subject, item)}
                                                                                    className={[
                                                                                        "px-3 py-1.5 border rounded-lg text-sm font-bold flex items-center gap-2 transition select-none",
                                                                                        isMadeUp
                                                                                            ? "bg-slate-100 text-slate-400 border-slate-200 line-through"
                                                                                            : "bg-red-50 text-red-600 border-red-100 hover:bg-red-100",
                                                                                        loadingKey === k ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                                                                                    ].join(" ")}
                                                                                    title={isMadeUp ? "Made up (click to undo)" : "Missing (click to mark made up)"}
                                                                                >
                                                                                    {isMadeUp ? <span className="text-slate-400">✓</span> : <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />}
                                                                                    {item}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
