import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Activity, Zap, Star, AlertTriangle, Check } from 'lucide-react';
import { REWARD_ICON_MAP } from '@/constants/rewardConfig';
import { ClassReward } from '../CoinAwardModal';
import React from 'react';

interface StudentOverviewProps {
    student: {
        id: string;
        display_name: string | null;
        coins: number;
    };
    onUpdateCoins: () => void;
    isGuestMode?: boolean;
    guestToken?: string;
}

interface Transaction {
    id: string;
    amount: number;
    reason: string;
    created_at: string;
}

const SUB_OPTIONS = ["中文", "英文", "數學", "常識", "其他"];
const SPECIAL_REWARD_TITLE = "完成班務（欠功課）";

export function StudentOverview({ student, onUpdateCoins, isGuestMode = false, guestToken }: StudentOverviewProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [rewards, setRewards] = useState<ClassReward[]>([]);
    const [consequences, setConsequences] = useState<ClassReward[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [manualAmount, setManualAmount] = useState<string>('0');
    const [manualReason, setManualReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sub-options selection
    const [pendingSubOptions, setPendingSubOptions] = useState<{ reward: ClassReward; selected: string[] } | null>(null);

    useEffect(() => {
        if (student?.id) {
            fetchData();
        }
    }, [student.id]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Transactions
            const { data: txData, error: txError } = await (supabase
                .from('coin_transactions' as any)
                .select('*')
                .eq('user_id', student.id)
                .order('created_at', { ascending: false })
                .limit(20) as any);

            if (txError) throw txError;

            // Fetch Rewards/Consequences from class_rewards
            const { data: rewardsData, error: rError } = await supabase
                .from('class_rewards')
                .select('*')
                .order('title', { ascending: true });

            if (rError) throw rError;

            const allItems = rewardsData || [];
            setRewards(allItems.filter(item => item.coins >= 0));
            setConsequences(allItems.filter(item => item.coins < 0));

            setTransactions(txData || []);
        } catch (err) {
            console.error('Error fetching student data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubOptionToggle = (option: string) => {
        if (!pendingSubOptions) return;
        const selected = pendingSubOptions.selected.includes(option)
            ? pendingSubOptions.selected.filter(o => o !== option)
            : [...pendingSubOptions.selected, option];
        setPendingSubOptions({ ...pendingSubOptions, selected });
    };

    const handleSubOptionSubmit = () => {
        if (!pendingSubOptions || pendingSubOptions.selected.length === 0) return;
        const reason = `${pendingSubOptions.reward.title}: ${pendingSubOptions.selected.join(', ')}`;
        handleAwardCoins(pendingSubOptions.reward.coins, reason);
        setPendingSubOptions(null);
    };

    const handleItemClick = (item: ClassReward) => {
        if (isSubmitting) return;
        if (item.title === SPECIAL_REWARD_TITLE) {
            setPendingSubOptions({ reward: item, selected: [] });
        } else {
            handleAwardCoins(item.coins, item.title);
        }
    };

    const handleAwardCoins = async (amount: number, reason: string) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            if (isGuestMode) {
                const { error } = await supabase.functions.invoke('public-access/submit-reward', {
                    body: {
                        token: guestToken,
                        targetUserIds: [student.id],
                        amount: amount,
                        reason: reason
                    }
                });

                if (error) throw error;
                alert('Reward request submitted for approval!');
            } else {
                const { data: { user } } = await supabase.auth.getUser();

                // Update Room Data via Admin RPC
                const { error: roomError } = await (supabase.rpc as any)('increment_room_coins', {
                    target_user_id: student.id,
                    amount: amount,
                    log_reason: reason,
                    log_admin_id: user?.id
                });

                if (roomError) throw roomError;

                // Refresh UI
                await fetchData();
                onUpdateCoins();
            }

            setManualAmount('0');
            setManualReason('');

        } catch (err) {
            console.error('Error awarding coins:', err);
            alert(isGuestMode ? 'Failed to submit request' : 'Failed to update coins');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-8 relative">
            {/* Sub-option Selection Overlay (Modal style context) */}
            {pendingSubOptions && (
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-1 text-center">{pendingSubOptions.reward.title}</h3>
                        <p className="text-[10px] text-slate-400 mb-6 text-center uppercase tracking-widest font-bold">Total 10 Coins</p>

                        <div className="grid grid-cols-2 gap-2 mb-6">
                            {SUB_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => handleSubOptionToggle(opt)}
                                    className={`px-3 py-3 rounded-xl border-2 font-bold transition-all text-xs
                                        ${pendingSubOptions.selected.includes(opt)
                                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                                            : 'border-slate-50 bg-slate-50/50 text-slate-400 hover:border-slate-100'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setPendingSubOptions(null)}
                                className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubOptionSubmit}
                                disabled={pendingSubOptions.selected.length === 0}
                                className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 text-xs"
                            >
                                Award 10 Coins
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    {/* Reward Panel */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Zap className="text-yellow-500" size={20} />
                            Quick Rewards
                        </h3>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                            {rewards.map(item => (
                                <button
                                    key={item.id}
                                    disabled={isSubmitting}
                                    onClick={() => handleItemClick(item)}
                                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-center group"
                                >
                                    <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mb-1 group-hover:scale-110 transition-transform`}>
                                        {React.createElement(REWARD_ICON_MAP[item.icon] || Star, { size: 20 })}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-700 block w-full truncate mb-0.5">
                                        {item.title}
                                    </span>
                                    <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                        +{item.coins}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Consequences</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                                {consequences.map(item => (
                                    <button
                                        key={item.id}
                                        disabled={isSubmitting}
                                        onClick={() => handleItemClick(item)}
                                        className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50 transition-all text-center group"
                                    >
                                        <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mb-1 group-hover:scale-110 transition-transform`}>
                                            {React.createElement(REWARD_ICON_MAP[item.icon] || AlertTriangle, { size: 20 })}
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-700 block w-full truncate mb-0.5">
                                            {item.title}
                                        </span>
                                        <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                            {item.coins}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Manual Adjustment</h4>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={manualAmount}
                                    onChange={(e) => setManualAmount(e.target.value)}
                                    className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-xs text-center font-bold"
                                />
                                <input
                                    type="text"
                                    placeholder="Reason..."
                                    value={manualReason}
                                    onChange={(e) => setManualReason(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs"
                                />
                                <button
                                    disabled={isSubmitting || !parseInt(manualAmount)}
                                    onClick={() => handleAwardCoins(parseInt(manualAmount), manualReason || 'Manual adjustment')}
                                    className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
                                >
                                    {isSubmitting ? '...' : 'Apply'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Activity className="text-blue-500" size={20} />
                        Recent Activity
                    </h3>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[500px]">
                        {isLoading ? (
                            <div className="text-center py-8 text-slate-400">Loading history...</div>
                        ) : transactions.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <p>No recent activity recorded.</p>
                            </div>
                        ) : (
                            transactions.map(tx => (
                                <div key={tx.id} className="flex gap-4 items-start pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-black
                                        ${tx.amount >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}
                                    `}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 text-sm truncate">{tx.reason}</p>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                                            <Calendar size={12} />
                                            {formatDate(tx.created_at)}
                                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <span>by Admin</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
