import React from 'react';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    class?: string | null;
    seat_number: number | null;
    morning_status?: 'todo' | 'review' | 'completed' | 'absent';
    last_morning_update?: string;
}

interface MorningDutiesBoardProps {
    users: UserWithCoins[];
    onReviewClick: (userId: string) => void; // Triggered when clicking a student in "Review" or "Todo"
}

export const MorningDutiesBoard: React.FC<MorningDutiesBoardProps> = ({ users, onReviewClick }) => {
    // Use HK time to match backend
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });

    // Categorize users
    const todoUsers = users.filter(u =>
        !u.morning_status ||
        u.morning_status === 'todo' ||
        u.last_morning_update !== today
    );

    const reviewUsers = users.filter(u =>
        u.morning_status === 'review' &&
        u.last_morning_update === today
    );

    const completedUsers = users.filter(u =>
        (u.morning_status === 'completed' || u.morning_status === 'absent') &&
        u.last_morning_update === today
    );

    // Sort by seat number
    const sortBySeat = (a: UserWithCoins, b: UserWithCoins) => (a.seat_number || 999) - (b.seat_number || 999);
    todoUsers.sort(sortBySeat);
    reviewUsers.sort(sortBySeat);
    completedUsers.sort(sortBySeat);

    const renderCard = (user: UserWithCoins, status: 'todo' | 'review' | 'completed' | 'absent') => (
        <div
            key={user.id}
            onClick={() => onReviewClick(user.id)}
            className={`
                relative p-1.5 px-2 rounded-lg border shadow-sm flex items-center gap-2 w-fit cursor-pointer hover:shadow-md transition-all
                ${status === 'todo' ? 'bg-white border-slate-200 hover:border-slate-300' : ''}
                ${status === 'review' ? 'bg-orange-50 border-orange-200 hover:border-orange-300' : ''}
                ${status === 'completed' || status === 'absent' ? 'bg-green-50 border-green-200 hover:border-green-300' : ''}
            `}
        >
            <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${status === 'review' ? 'bg-orange-200 text-orange-800' : 'bg-slate-100 text-slate-600'}`}>
                    {user.seat_number || '-'}
                </span>
                <p className="font-bold text-xs truncate text-slate-700">
                    {user.display_name || 'Student'}
                    {status === 'absent' && <span className="ml-1 text-[10px] font-medium text-slate-400 font-normal">(absent)</span>}
                </p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col md:flex-row gap-6 mb-6 bg-slate-100/30 p-4 rounded-2xl border border-slate-200 w-fit">
            {/* TODO Column */}
            <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                    <h3 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                        <Clock size={14} />
                        Todo
                    </h3>
                    <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {todoUsers.length}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin content-start">
                    {todoUsers.map(u => renderCard(u, 'todo'))}
                    {todoUsers.length === 0 && (
                        <div className="w-full text-center py-4 text-slate-400 text-[10px] italic">
                            Done!
                        </div>
                    )}
                </div>
            </div>

            {/* Review Column */}
            <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-orange-200">
                    <h3 className="font-bold text-orange-700 text-xs flex items-center gap-1.5">
                        <AlertCircle size={14} />
                        Review
                    </h3>
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {reviewUsers.length}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin content-start">
                    {reviewUsers.map(u => renderCard(u, 'review'))}
                    {reviewUsers.length === 0 && (
                        <div className="w-full text-center py-4 text-slate-400 text-[10px] italic">
                            Clear
                        </div>
                    )}
                </div>
            </div>

            {/* Completed Column */}
            <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-green-200">
                    <h3 className="font-bold text-green-700 text-xs flex items-center gap-1.5">
                        <CheckCircle2 size={14} />
                        Done
                    </h3>
                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {completedUsers.length}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin content-start">
                    {completedUsers.map(u => renderCard(u, u.morning_status || 'completed'))}
                    {completedUsers.length === 0 && (
                        <div className="w-full text-center py-4 text-slate-400 text-[10px] italic">
                            Waiting...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
