import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, CheckCircle, AlertCircle, Clock, BookOpen, Layers, Coins } from 'lucide-react';

interface StudentHomeworkProps {
    studentId: string;
}

interface HomeworkRecord {
    id: string;
    message: string;
    type: 'positive' | 'neutral' | 'negative';
    created_at: string;
    coin_amount: number;
}

const HOMEWORK_REWARDS = [
    "完成班務（交齊功課）",
    "完成班務（欠功課）",
    "完成班務（寫手冊）"
];

export function StudentHomework({ studentId }: StudentHomeworkProps) {
    const [records, setRecords] = useState<HomeworkRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'general' | 'specific'>('general');

    useEffect(() => {
        fetchHomeworkRecords();
    }, [studentId]);

    const fetchHomeworkRecords = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('student_records')
                .select('id, message, type, created_at, coin_amount')
                .eq('student_id', studentId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching homework records:', error);
            } else {
                // Filter records that include our target homework reward strings
                // Cast to any because coin_amount might not be in the local types yet
                const filtered = (data as any[] || []).filter(r =>
                    HOMEWORK_REWARDS.some(target => r.message.includes(target))
                );
                setRecords(filtered);
            }
        } catch (err) {
            console.error('Unexpected error fetching homework:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Parsing specific sub-options stats
    const getSubOptionsStats = () => {
        const stats: Record<string, number> = {};
        records.forEach(r => {
            if (r.message.includes(':')) {
                const subStr = r.message.split(':')[1];
                if (subStr) {
                    const items = subStr.split(',').map(s => s.trim());
                    items.forEach(item => {
                        if (item) {
                            stats[item] = (stats[item] || 0) + 1;
                        }
                    });
                }
            }
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-sm font-bold animate-pulse uppercase tracking-widest">Analyzing Homework Data...</p>
            </div>
        );
    }

    const specificStats = getSubOptionsStats();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header with quick stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-blue-600">{records.length}</span>
                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-tight">Total Entries</span>
                </div>
                <div className="bg-green-50 p-3 rounded-2xl border border-green-100 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-green-600">
                        {records.filter(r => r.message.includes('交齊功課')).length}
                    </span>
                    <span className="text-[10px] text-green-400 font-bold uppercase tracking-tight">On Time</span>
                </div>
                <div className="bg-red-50 p-3 rounded-2xl border border-red-100 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-red-600">
                        {records.filter(r => r.message.includes('欠功課')).length}
                    </span>
                    <span className="text-[10px] text-red-400 font-bold uppercase tracking-tight">Missing</span>
                </div>
            </div>

            {/* Sub-navigation */}
            <div className="flex gap-2 p-1 bg-slate-100/80 rounded-[1.25rem] w-full max-w-[300px] border border-slate-200/50">
                <button
                    onClick={() => setActiveSubTab('general')}
                    className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'general' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    General Record
                </button>
                <button
                    onClick={() => setActiveSubTab('specific')}
                    className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'specific' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    Specific
                </button>
            </div>

            {activeSubTab === 'general' ? (
                <div className="space-y-3">
                    {records.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-3xl border border-slate-100 shadow-sm opacity-50">
                            <ClipboardList size={48} className="text-slate-200 mb-4" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Homework Records Found</p>
                        </div>
                    ) : (
                        records.map(record => (
                            <div key={record.id} className="group bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4 items-start transition-all hover:shadow-md hover:border-blue-100">
                                <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${record.type === 'positive' ? 'bg-green-100 text-green-600' :
                                    record.type === 'negative' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                    {record.message.includes('交齊功課') ? <CheckCircle size={16} /> :
                                        record.message.includes('欠功課') ? <AlertCircle size={16} /> : <BookOpen size={16} />}
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-slate-800 font-bold text-sm leading-tight group-hover:text-blue-600 transition-colors">
                                        {record.message}
                                    </h4>
                                    <div className="flex items-center gap-4 mt-2.5 text-[10px] text-slate-400 font-bold">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 rounded-full">
                                            <Clock size={12} className="opacity-70" />
                                            {new Date(record.created_at).toLocaleString('zh-HK', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                        {record.coin_amount !== 0 && (
                                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${record.coin_amount > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                                                }`}>
                                                <Coins size={10} />
                                                {record.coin_amount > 0 ? `+${record.coin_amount}` : record.coin_amount}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {specificStats.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 px-4 bg-white rounded-3xl border border-slate-100 shadow-sm opacity-50">
                            <Layers size={48} className="text-slate-200 mb-4" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center">No Specific Homework Items Recorded</p>
                            <p className="text-[10px] text-slate-400 mt-2 text-center uppercase tracking-tight">Items will appear here when sub-options are selected during awarding</p>
                        </div>
                    ) : (
                        specificStats.map(([item, count]) => (
                            <div key={item} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-all hover:shadow-md">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 flex items-center justify-center font-black border border-blue-100 shadow-inner group-hover:scale-110 transition-transform">
                                        {item[0]}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-black text-slate-700 leading-none">{item}</span>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Homework Item</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="flex items-baseline gap-0.5">
                                        <span className="text-2xl font-black text-blue-600 group-hover:scale-110 transition-transform">{count}</span>
                                    </div>
                                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Recorded</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
