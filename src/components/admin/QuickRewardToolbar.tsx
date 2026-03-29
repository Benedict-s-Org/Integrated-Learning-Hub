import { useState, useEffect } from 'react';
import { REWARD_ICON_MAP } from '@/constants/rewardConfig';
import { QuickRewardShortcut } from './CoinAwardModal';

interface QuickRewardToolbarProps {
    studentId: string;
    availableRewards: any[];
    onQuickAward: (userId: string, amount: number, reason: string) => Promise<void>;
    className?: string;
}

export const EMPTY_SHORTCUTS: QuickRewardShortcut[] = [
    { id: '1', rewardId: null },
    { id: '2', rewardId: null },
    { id: '3', rewardId: null },
    { id: '4', rewardId: null },
    { id: '5', rewardId: null },
    { id: '6', rewardId: null },
];

export function QuickRewardToolbar({ studentId, availableRewards, onQuickAward, className }: QuickRewardToolbarProps) {
    const [shortcuts, setShortcuts] = useState<QuickRewardShortcut[]>([]);
    const [isAwarding, setIsAwarding] = useState<string | null>(null);

    const STORAGE_KEY = `quick_reward_shortcuts_${className || 'global'}`;

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Handle legacy format or missing rewardId
                if (parsed.length > 0 && ('reason' in parsed[0])) {
                    setShortcuts(EMPTY_SHORTCUTS);
                } else {
                    setShortcuts(parsed);
                }
            } catch (e) {
                console.error('Failed to parse shortcuts', e);
                setShortcuts(EMPTY_SHORTCUTS);
            }
        } else {
            setShortcuts(EMPTY_SHORTCUTS);
        }
    }, [STORAGE_KEY]);

    const handleAction = async (shortcut: QuickRewardShortcut) => {
        if (isAwarding || !shortcut.rewardId) return;
        
        const reward = availableRewards.find(r => r.id === shortcut.rewardId);
        if (!reward) return;

        setIsAwarding(shortcut.id);
        try {
            await onQuickAward(studentId, reward.coins, reward.title);
        } finally {
            setIsAwarding(null);
        }
    };

    return (
        <div className="flex items-center gap-1 mt-1 pointer-events-auto">
            <div className="flex bg-slate-50/50 backdrop-blur-sm border border-slate-200/50 rounded-xl p-0.5 gap-0.5 shadow-sm min-h-[22px]">
                {shortcuts.map((s) => {
                    const reward = availableRewards.find(r => r.id === s.rewardId);
                    if (!reward) return null;

                    const IconComp = REWARD_ICON_MAP[reward.icon] || REWARD_ICON_MAP.Star;
                    return (
                        <button
                            key={s.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAction(s);
                            }}
                            disabled={!!isAwarding}
                            className={`
                                flex items-center justify-center p-1 rounded-lg transition-all active:scale-95
                                hover:brightness-95 disabled:opacity-50
                                ${reward.color || 'bg-white text-slate-600 border border-slate-100'}
                            `}
                            title={`${reward.title} (${reward.coins > 0 ? '+' : ''}${reward.coins})`}
                        >
                            <IconComp size={14} className={isAwarding === s.id ? 'animate-pulse' : ''} />
                        </button>
                    );
                })}
                {shortcuts.every(s => !s.rewardId) && (
                    <div className="px-2 text-[10px] text-slate-400 font-medium italic flex items-center">
                        No shortcuts
                    </div>
                )}
            </div>
        </div>
    );
}
