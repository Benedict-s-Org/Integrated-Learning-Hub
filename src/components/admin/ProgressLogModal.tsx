import { useState, useEffect } from 'react';
import {
    X,
    History,
    RotateCcw,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Search,
    Check,
    Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { coinService } from '@/services/coinService';

interface ProgressLogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Simple native date formatter
const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(date);
};

type TabType = 'active' | 'reverted';

interface LogEntry {
    id: string;
    student_id: string;
    message: string;
    type: 'positive' | 'neutral' | 'negative';
    coin_amount: number;
    created_at: string;
    is_reverted: boolean;
    reverted_at: string | null;
    is_virtual: boolean;
    student: {
        display_name: string;
        username: string;
    } | null;
}

export function ProgressLogModal({ isOpen, onClose }: ProgressLogModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('active');
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchEntries();
            coinService.cleanupOldRecords(); // Opportunistic cleanup
        }
    }, [isOpen, activeTab]);

    const fetchEntries = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('student_records')
                .select(`
                    *,
                    student:users!student_records_student_id_fkey (
                        display_name,
                        username
                    )
                `)
                .eq('is_reverted', activeTab === 'reverted')
                .or('coin_amount.neq.0,message.ilike.%Toilet/Break%') // Show valid coin impacts OR toilet time logs
                .order(activeTab === 'active' ? 'created_at' : 'reverted_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setEntries(data as any || []);
        } catch (err: any) {
            console.error('Error fetching log entries:', err.message, err.details, err.hint);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevert = async (id: string) => {
        if (!confirm('Are you sure you want to revert this record? Student balance will be updated.')) return;

        setIsActionLoading(true);
        const result = await coinService.revertRecord(id);
        if (result.success) {
            fetchEntries();
        } else {
            alert('Failed to revert record.');
        }
        setIsActionLoading(false);
    };

    const handleBulkRevert = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Revert ${selectedIds.length} records?`)) return;

        setIsActionLoading(true);
        const result = await coinService.bulkRevertRecords(selectedIds);
        if (result.success) {
            setSelectedIds([]);
            fetchEntries();
        } else {
            alert('Failed to revert some records.');
        }
        setIsActionLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Permanently delete this reverted record? This cannot be undone.')) return;

        setIsActionLoading(true);
        const { error } = await supabase
            .from('student_records')
            .delete()
            .eq('id', id);

        if (!error) {
            fetchEntries();
        } else {
            alert('Failed to delete record.');
        }
        setIsActionLoading(false);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const filteredEntries = entries.filter(entry =>
        entry.student?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] border border-white/20">

                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-gradient-to-br from-slate-50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                            <History className="text-white" size={28} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                                Progress Log
                            </h3>
                            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                Rewards & Consequences History
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 border border-slate-100 shadow-sm active:scale-95"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs & Search Area */}
                <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex flex-col gap-6">
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`px-8 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2
                                ${activeTab === 'active'
                                    ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Active Log
                        </button>
                        <button
                            onClick={() => setActiveTab('reverted')}
                            className={`px-8 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2
                                ${activeTab === 'reverted'
                                    ? 'bg-white text-orange-600 shadow-md ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Reverted Record
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="relative flex-1 min-w-[300px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by student or record..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                            />
                        </div>

                        {selectedIds.length > 0 && activeTab === 'active' && (
                            <button
                                onClick={handleBulkRevert}
                                disabled={isActionLoading}
                                className="px-6 py-3.5 bg-orange-600 text-white font-black rounded-2xl shadow-xl shadow-orange-100 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2 disabled:opacity-50"
                            >
                                {isActionLoading ? <Loader2 className="animate-spin" size={20} /> : <RotateCcw size={20} />}
                                Bulk Revert ({selectedIds.length})
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <Loader2 className="animate-spin text-blue-500" size={40} />
                            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading records...</p>
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-300 gap-4">
                            <History size={64} strokeWidth={1} />
                            <p className="font-bold italic">No records found matching your search.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredEntries.map((entry) => (
                                <div
                                    key={entry.id}
                                    className={`p-4 rounded-3xl border-2 transition-all flex items-center gap-4 group
                                        ${entry.is_reverted
                                            ? 'bg-slate-50/50 border-slate-100'
                                            : selectedIds.includes(entry.id)
                                                ? 'bg-blue-50 border-blue-200 shadow-sm'
                                                : 'bg-white border-transparent hover:border-slate-100 hover:bg-slate-50/30'}`}
                                >
                                    {activeTab === 'active' && (
                                        <button
                                            onClick={() => toggleSelect(entry.id)}
                                            className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all
                                                ${selectedIds.includes(entry.id)
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white border-slate-200 group-hover:border-blue-300'}`}
                                        >
                                            {selectedIds.includes(entry.id) && <Check size={18} />}
                                        </button>
                                    )}

                                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="min-w-[140px]">
                                            <p className="font-black text-slate-800 text-lg leading-tight">
                                                {entry.student?.display_name || 'Unknown'}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                {formatDate(entry.is_reverted ? entry.reverted_at! : entry.created_at)}
                                            </p>
                                        </div>

                                        <div className="flex-1">
                                            <p className="font-bold text-slate-600 text-sm">
                                                {entry.message}
                                                {entry.is_virtual && (
                                                    <span className="ml-2 px-2 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-black uppercase rounded-lg border border-purple-100">
                                                        Virtual
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className={`min-w-[70px] text-right font-black text-xl
                                                ${entry.type === 'positive' ? 'text-green-500' : 'text-red-500'}`}>
                                                {entry.coin_amount > 0 ? '+' : ''}{entry.coin_amount}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {activeTab === 'active' ? (
                                                    <button
                                                        onClick={() => handleRevert(entry.id)}
                                                        disabled={isActionLoading}
                                                        className="p-3 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-2xl transition-all active:scale-90"
                                                        title="Revert Record"
                                                    >
                                                        <RotateCcw size={20} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleDelete(entry.id)}
                                                        disabled={isActionLoading}
                                                        className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                                                        title="Delete Permanently"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tips/Summary Footer */}
                <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 grayscale opacity-50">
                            <CheckCircle2 size={14} className="text-green-500" /> Positive
                        </span>
                        <span className="flex items-center gap-1.5 grayscale opacity-50">
                            <AlertCircle size={14} className="text-red-500" /> Negative
                        </span>
                    </div>
                    {activeTab === 'reverted' && (
                        <p className="text-orange-600/60 flex items-center gap-2 italic">
                            <Loader2 size={12} className="animate-spin" /> Records older than 30 days are auto-deleted
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
