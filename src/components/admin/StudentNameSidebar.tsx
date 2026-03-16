import React from 'react';
import { User, X } from 'lucide-react';
import { useDashboardTheme } from '@/context/DashboardThemeContext';

interface UserWithCoins {
    id: string;
    display_name: string | null;
    class_number: number | null;
    daily_real_earned?: number;
    daily_reward_count?: number;
}

interface StudentNameSidebarProps {
    users: UserWithCoins[];
    onQuickAward: (userId: string) => void;
    onClose?: () => void;
    onPopOut?: () => void;
    isPoppedOut?: boolean;
}

export const StudentNameSidebar: React.FC<StudentNameSidebarProps> = ({ users, onQuickAward, onClose, onPopOut, isPoppedOut }) => {
    const { theme } = useDashboardTheme();
    const [cooldowns, setCooldowns] = React.useState<Set<string>>(new Set());

    const handleAward = (userId: string) => {
        if (cooldowns.has(userId)) return;

        // Add to cooldown
        setCooldowns(prev => new Set(prev).add(userId));

        // Trigger award
        onQuickAward(userId);

        // Remove from cooldown after 2 seconds
        setTimeout(() => {
            setCooldowns(prev => {
                const updated = new Set(prev);
                updated.delete(userId);
                return updated;
            });
        }, 2000);
    };

    // Sort logic: Students who have answered questions (daily_reward_count > 0) drop to the bottom.
    // Within those groups, sort by class number.
    const sortedUsers = [...users].sort((a, b) => {
        const aCount = a.daily_reward_count || 0;
        const bCount = b.daily_reward_count || 0;

        if (aCount !== bCount) {
            return aCount - bCount;
        }

        return (a.class_number || 999) - (b.class_number || 999);
    });

    return (
        <div className={isPoppedOut
            ? "flex flex-col w-full h-screen bg-white"
            : "fixed right-0 top-0 bottom-0 w-full md:w-48 flex flex-col z-[100] bg-white border-l border-slate-200 shadow-xl animate-in slide-in-from-right duration-300"
        }>
            <div className="pt-6 md:pt-24 pb-4 px-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                    <p className="text-[10px] text-slate-500 font-medium">Click name to award +1</p>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-2 mt-2 px-1 py-0.5 bg-slate-100/50 rounded-lg border border-slate-200/50">
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-700" />
                        <span className="text-[8px] font-bold text-slate-500">+1</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span className="text-[8px] font-bold text-slate-500">+2</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span className="text-[8px] font-bold text-slate-500">+3</span>
                    </div>
                </div>
                {onPopOut && !isPoppedOut && (
                    <button
                        onClick={onPopOut}
                        className="p-1 hover:bg-blue-100 rounded-lg text-blue-600 ml-auto mr-1 hidden md:block"
                        title="Pop out to floating window"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </button>
                )}
                {onClose && !isPoppedOut && (
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full md:hidden"
                        aria-label="Close sidebar"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1.5 scrollbar-hide hover:scrollbar-default">
                {sortedUsers.map((user) => {
                    const rewardCount = user.daily_reward_count || 0;
                    const isCompleted = rewardCount >= 3;
                    const isInCooldown = cooldowns.has(user.id);

                    // Progress and Colors based on reward count
                    let progressWidth = '0%';
                    let iconColorClass = 'bg-slate-100 text-slate-600';
                    let barColorClass = 'bg-blue-400';

                    if (rewardCount === 1) {
                        progressWidth = '33.3%';
                        iconColorClass = 'bg-orange-100 text-orange-800';
                        barColorClass = 'bg-orange-700';
                    } else if (rewardCount === 2) {
                        progressWidth = '66.7%';
                        iconColorClass = 'bg-slate-100 text-slate-600';
                        barColorClass = 'bg-slate-400';
                    } else if (rewardCount >= 3) {
                        progressWidth = '100%';
                        iconColorClass = 'bg-amber-100 text-amber-700';
                        barColorClass = 'bg-amber-500';
                    }

                    return (
                        <button
                            key={user.id}
                            onClick={() => handleAward(user.id)}
                            disabled={isInCooldown}
                            className={`w-full flex items-center gap-2 p-1.5 rounded-xl border transition-all group text-left relative overflow-hidden
                                ${isInCooldown
                                    ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed scale-95'
                                    : isCompleted
                                        ? 'bg-slate-50 border-slate-100 opacity-80 active:scale-95'
                                        : 'bg-white border-slate-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm active:scale-95'
                                } `}
                            title={isInCooldown ? "Wait 2 seconds..." : `Reward ${user.display_name} (${rewardCount} times)`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors shrink-0
                                ${rewardCount > 0
                                    ? iconColorClass
                                    : 'bg-slate-100 text-slate-600 group-hover:bg-blue-500 group-hover:text-white'
                                } `}>
                                <User size={14} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p 
                                    className="font-bold truncate leading-tight"
                                    style={{ fontSize: `${theme.sidebarFontSize || 11}px` }}
                                    data-theme-key="sidebarFontSize"
                                >
                                    {user.display_name}({user.class_number || '-'})
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 ${barColorClass} `}
                                            style={{ width: progressWidth }}
                                        />
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-400 group-hover:text-blue-100">
                                        {rewardCount}
                                    </span>
                                </div>
                            </div>

                            {isInCooldown && (
                                <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
                                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-ping" />
                                </div>
                            )}
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
