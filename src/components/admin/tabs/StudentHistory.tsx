import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, CheckCircle, AlertCircle, HelpCircle, Clock, Trash2, Loader2, Coins } from 'lucide-react';

interface StudentHistoryProps {
    studentId: string;
}

interface NotificationRecord {
    id: string;
    message: string;
    type: 'positive' | 'neutral' | 'negative';
    created_at: string;
    is_read: boolean;
    coin_amount?: number;
}

export function StudentHistory({ studentId }: StudentHistoryProps) {
    const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchHistory();
    }, [studentId]);

    const fetchHistory = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('student_records')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching history:', error);
        } else {
            setNotifications(data as NotificationRecord[]);
        }
        setIsLoading(false);
    };

    const handleDelete = async (id: string, message: string) => {
        if (!confirm(`Are you sure you want to delete this record?\n\n"${message}"\n\nNote: Any associated coins will be automatically reversed.`)) return;

        setIsDeleting(id);
        try {
            const { error } = await supabase
                .from('student_records')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Optimistic update
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete record');
        } finally {
            setIsDeleting(null);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-400">Loading history...</div>;
    }

    if (notifications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 opacity-50">
                <Bell size={48} className="mb-4" />
                <p>No notifications yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {notifications.map((note) => (
                <div
                    key={note.id}
                    className="group bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex gap-4 items-start transition-all hover:shadow-md"
                >
                    <div className={`
                        mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                        ${note.type === 'positive' ? 'bg-green-100 text-green-600' :
                            note.type === 'negative' ? 'bg-red-100 text-red-600' :
                                'bg-blue-100 text-blue-600'}
                    `}>
                        {note.type === 'positive' && <CheckCircle size={16} />}
                        {note.type === 'negative' && <AlertCircle size={16} />}
                        {note.type === 'neutral' && <HelpCircle size={16} />}
                    </div>

                    <div className="flex-1">
                        <div className="flex justify-between items-start gap-2">
                            <p className="text-slate-700 font-medium leading-relaxed">{note.message}</p>
                            <button
                                onClick={() => handleDelete(note.id, note.message)}
                                disabled={isDeleting === note.id}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                title="Delete record"
                            >
                                {isDeleting === note.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <div className="flex items-center gap-1.5">
                                <Clock size={12} />
                                {new Date(note.created_at).toLocaleString()}
                            </div>
                            {note.coin_amount !== undefined && note.coin_amount !== 0 && (
                                <div className={`flex items-center gap-1 font-bold ${note.coin_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    <Coins size={12} />
                                    {note.coin_amount > 0 ? `+${note.coin_amount}` : note.coin_amount}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
