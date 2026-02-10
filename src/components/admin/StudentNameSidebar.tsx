import React from 'react';
import { User } from 'lucide-react';

interface UserWithCoins {
    id: string;
    display_name: string | null;
    seat_number: number | null;
    daily_real_earned?: number;
}

interface StudentNameSidebarProps {
    users: UserWithCoins[];
    onQuickAward: (userId: string) => void;
}

export const StudentNameSidebar: React.FC<StudentNameSidebarProps> = ({ users, onQuickAward }) => {
    // Sort logic: Students with 10+ coins drop to the bottom, then sort by seat number
    const sortedUsers = [...users].sort((a, b) => {
        const aCompleted = (a.daily_real_earned || 0) >= 10;
        const bCompleted = (b.daily_real_earned || 0) >= 10;

        if (aCompleted && !bCompleted) return 1;
        if (!aCompleted && bCompleted) return -1;

        return (a.seat_number || 999) - (b.seat_number || 999);
    });

    return (
        <div className="fixed right-0 top-0 bottom-0 w-48 flex flex-col z-50 bg-white border-l border-slate-200 shadow-xl animate-in slide-in-from-right duration-300">
            <div className="pt-24 pb-4 px-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <h3 className="font-bold text-slate-900 text-sm">Quick Rewards</h3>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Click name to award +1</p>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1.5 scrollbar-hide hover:scrollbar-default">
                {sortedUsers.map((user) => {
                    const dailyCoins = user.daily_real_earned || 0;
                    const rewardCount = Math.floor(dailyCoins / 10);
                    const isCompleted = dailyCoins >= 10;

                    // Progress and Colors based on reward count
                    let progressWidth = '0%';
                    let iconColorClass = 'bg-slate-100 text-slate-600';
                    let barColorClass = 'bg-blue-400';

                    if (rewardCount === 1) {
                        progressWidth = '33.3%';
                        iconColorClass = 'bg-green-100 text-green-700';
                        barColorClass = 'bg-green-500';
                    } else if (rewardCount === 2) {
                        progressWidth = '66.7%';
                        iconColorClass = 'bg-yellow-100 text-yellow-700';
                        barColorClass = 'bg-yellow-500';
                    } else if (rewardCount >= 3) {
                        progressWidth = '100%';
                        iconColorClass = 'bg-red-100 text-red-700';
                        barColorClass = 'bg-red-500';
                    }

                    return (
                        <button
                            key={user.id}
                            onClick={() => onQuickAward(user.id)}
                            className={`w-full flex items-center gap-2 p-1.5 rounded-xl border transition-all active:scale-95 group text-left relative overflow-hidden
                                ${isCompleted
                                    ? 'bg-slate-50 border-slate-100 opacity-80'
                                    : 'bg-white border-slate-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm'}`}
                            title={`Reward ${user.display_name} (${rewardCount} times)`}
                        >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors shrink-0
                                ${rewardCount > 0
                                    ? iconColorClass
                                    : 'bg-slate-100 text-slate-600 group-hover:bg-blue-500 group-hover:text-white'}`}>
                                {user.seat_number || <User size={10} />}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-[11px] truncate leading-tight">
                                    {user.display_name || 'Student'}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${barColorClass}`}
                                            style={{ width: progressWidth }}
                                        />
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-400 group-hover:text-blue-100">
                                        {rewardCount}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="mt-2 py-2 border-t border-slate-200/50 text-[10px] text-slate-400 text-center font-medium bg-slate-50/30">
                Sorted by Reward Progress
            </div>
        </div>
    );
};
