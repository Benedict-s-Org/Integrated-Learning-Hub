import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, CheckCircle, AlertCircle, HelpCircle, Clock } from 'lucide-react';

interface StudentHistoryProps {
    studentId: string;
}

interface NotificationRecord {
    id: string;
    message: string;
    type: 'positive' | 'neutral' | 'negative';
    created_at: string;
    is_read: boolean;
}

export function StudentHistory({ studentId }: StudentHistoryProps) {
    const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
                    className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex gap-4 items-start transition-all hover:shadow-md"
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
                        <p className="text-slate-700 font-medium leading-relaxed">{note.message}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                            <Clock size={12} />
                            {new Date(note.created_at).toLocaleString()}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
