import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Star, AlertTriangle, Trash2 } from 'lucide-react';
import { REWARD_ICON_MAP } from '@/constants/rewardConfig';
import { ClassReward } from '../CoinAwardModal';
import { useAuth } from '@/context/AuthContext';
import { playSuccessSound } from '@/utils/audio';
import React from 'react';

interface StudentOverviewProps {
    student: {
        id: string;
        display_name: string | null;
        coins: number;
    };
    onUpdateCoins: () => void;
    onSuccess?: () => void;
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

export function StudentOverview({ student, onUpdateCoins, onSuccess, isGuestMode = false, guestToken }: StudentOverviewProps) {
    const { isAdmin } = useAuth();
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
            const { data: rewardsData, error: rError } = await (supabase
                .from('class_rewards' as any)
                .select('*')
                .order('title', { ascending: true }) as any);

            if (rError) throw rError;

            const allItems: ClassReward[] = rewardsData || [];
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

        // Robust title matching for "完成班務（欠功課）"
        const isSpecialReward = item.title.trim().includes("完成班務") && item.title.includes("欠功課");

        if (isSpecialReward) {
            setPendingSubOptions({ reward: item, selected: [] });
        } else {
            handleAwardCoins(item.coins, item.title);
        }
    };

    const handleRevertTransaction = async (transactionId: string) => {
        if (!confirm('Are you sure you want to revert this transaction? The coins will be deducted from the student.')) return;

        setIsSubmitting(true);
        try {
            const { error } = await (supabase.rpc as any)('revert_coin_transaction', {
                transaction_id: transactionId
            });

            if (error) throw error;

            // Refresh UI
            await fetchData();
            onUpdateCoins();
        } catch (error) {
            console.error('Error reverting transaction:', error);
            alert('Failed to revert transaction');
        } finally {
            setIsSubmitting(false);
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

                playSuccessSound();
                if (onSuccess) onSuccess();
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

                playSuccessSound();
                if (onSuccess) onSuccess();

                // Refresh UI
                await fetchData();
                onUpdateCoins();
            }

            setManualAmount('0');
            setManualReason('');

        } catch (err) {
            console.error('Error awarding coins:', err);
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
        <div className="space-y-6 relative flex flex-col h-full">
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

            {/* Layout Reordered for Reachability: Activity TOP, Rewards BOTTOM */}
            <div className="flex flex-col gap-6">
                {/* 1. Recent Activity Feed (Upper part) */}
                <div className="bg-white/50 backdrop-blur-sm p-5 rounded-3xl border border-white shadow-sm flex flex-col order-1">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Activity className="text-blue-500" size={14} />
                        Recent Progress
                    </h3>

                    <div className="overflow-y-auto pr-1 space-y-3 max-h-[180px] no-scrollbar">
                        {isLoading ? (
                            <div className="text-center py-4 text-slate-400 animate-pulse text-xs">Syncing history...</div>
                        ) : transactions.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 bg-slate-100/50 rounded-2xl border-2 border-dashed border-slate-200/50">
                                <p className="text-[10px] font-bold uppercase tracking-widest">No activity yet</p>
                            </div>
                        ) : (
                            transactions.map(tx => (
                                <div key={tx.id} className="flex gap-3 items-center p-3 bg-white/40 rounded-2xl border border-white/60">
                                    <div className={`
                                        w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-black
                                        ${tx.amount >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}
                                    `}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-700 text-xs truncate leading-none mb-1">{tx.reason}</p>
                                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                            {formatDate(tx.created_at)}
                                        </div>
                                    </div>
                                    {!isGuestMode && isAdmin && (
                                        <button
                                            onClick={() => handleRevertTransaction(tx.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            title="Revert transaction"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 2. Rewards Section (Lower part - Reachable) */}
                <div className="bg-white p-5 rounded-[2rem] border border-slate-200/40 shadow-sm space-y-6 order-2">
                    {/* Positive Rewards */}
                    <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Star className="text-yellow-500" size={14} />
                            Quick Rewards
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {rewards.map(item => (
                                <button
                                    key={item.id}
                                    disabled={isSubmitting}
                                    onClick={() => handleItemClick(item)}
                                    className="flex flex-col items-center justify-center p-2.5 rounded-[1.5rem] border-2 border-slate-50 hover:border-blue-300 hover:bg-blue-50 transition-all text-center group bg-slate-50/50"
                                >
                                    <div className={`w-9 h-9 rounded-2xl ${item.color} flex items-center justify-center mb-1 group-hover:scale-110 transition-transform`}>
                                        {React.createElement(REWARD_ICON_MAP[item.icon] || Star, { size: 18 })}
                                    </div>
                                    <span className="text-[9px] font-black text-slate-700 block w-full truncate uppercase tracking-tighter mb-0.5">
                                        {item.title}
                                    </span>
                                    <span className="text-[10px] font-black text-green-600">
                                        +{item.coins}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Negative Consequences */}
                    <div className="border-t border-slate-100 pt-5">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <AlertTriangle className="text-red-500" size={14} />
                            Consequences
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {consequences.map(item => (
                                <button
                                    key={item.id}
                                    disabled={isSubmitting}
                                    onClick={() => handleItemClick(item)}
                                    className="flex flex-col items-center justify-center p-2.5 rounded-[1.5rem] border-2 border-slate-50 hover:border-red-300 hover:bg-red-50 transition-all text-center group bg-slate-50/50"
                                >
                                    <div className={`w-9 h-9 rounded-2xl ${item.color} flex items-center justify-center mb-1 group-hover:scale-110 transition-transform`}>
                                        {React.createElement(REWARD_ICON_MAP[item.icon] || AlertTriangle, { size: 18 })}
                                    </div>
                                    <span className="text-[9px] font-black text-slate-700 block w-full truncate uppercase tracking-tighter mb-0.5">
                                        {item.title}
                                    </span>
                                    <span className="text-[10px] font-black text-red-600">
                                        {item.coins}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. Manual Adjustment (Bottom-most) */}
                    <div className="border-t border-slate-100 pt-5">
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={manualAmount}
                                onChange={(e) => setManualAmount(e.target.value)}
                                className="w-16 px-2 py-3 border-2 border-slate-100 rounded-2xl text-xs text-center font-black focus:border-blue-400 outline-none transition-all"
                                placeholder="0"
                            />
                            <input
                                type="text"
                                placeholder="Custom reason..."
                                value={manualReason}
                                onChange={(e) => setManualReason(e.target.value)}
                                className="flex-1 px-4 py-3 border-2 border-slate-100 rounded-2xl text-xs font-bold focus:border-blue-400 outline-none transition-all"
                            />
                            <button
                                disabled={isSubmitting || !parseInt(manualAmount)}
                                onClick={() => handleAwardCoins(parseInt(manualAmount), manualReason || 'Manual adjustment')}
                                className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 disabled:opacity-50 transition-all active:scale-95"
                            >
                                {isSubmitting ? '...' : 'Apply'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
