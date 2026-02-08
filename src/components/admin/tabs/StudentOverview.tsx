import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Activity, Zap } from 'lucide-react';

interface StudentOverviewProps {
    student: {
        id: string;
        display_name: string | null;
        coins: number;
    };
    onUpdateCoins: () => void;
}

interface Transaction {
    id: string;
    amount: number;
    reason: string;
    created_at: string;
}

interface TargetBehavior {
    id: string;
    label: string;
    icon: string;
    coin_value: number;
    category: string;
}

export function StudentOverview({ student, onUpdateCoins }: StudentOverviewProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [behaviors, setBehaviors] = useState<TargetBehavior[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [manualAmount, setManualAmount] = useState<string>('0');
    const [manualReason, setManualReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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

            // Fetch Behaviors
            const { data: behaviorData, error: bError } = await (supabase
                .from('target_behaviors' as any)
                .select('*')
                .eq('is_active', true)
                .order('category')
                .order('label') as any);

            if (bError) throw bError;

            setTransactions(txData || []);
            setBehaviors(behaviorData || []);
        } catch (err) {
            console.error('Error fetching student data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAwardCoins = async (amount: number, reason: string) => {
        if (!amount || !reason) return;

        setIsSubmitting(true);
        try {
            // 1. Update Room Data (Actual Balance)
            const { error: roomError } = await supabase.rpc('increment_room_coins', {
                target_user_id: student.id,
                amount: amount
            });

            if (roomError) throw roomError;

            // 2. Log Transaction History
            const { error: logError } = await (supabase
                .from('coin_transactions' as any)
                .insert({
                    user_id: student.id,
                    amount: amount,
                    reason: reason
                }) as any);

            if (logError) console.error('Failed to log transaction:', logError);

            // 3. Refresh UI
            await fetchData();
            onUpdateCoins(); // Update parent component
            setManualAmount('0');
            setManualReason('');

        } catch (err) {
            console.error('Error awarding coins:', err);
            alert('Failed to update coins');
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
        <div className="space-y-8">
            {/* Quick Actions / Manual Award */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Reward Panel */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Zap className="text-yellow-500" size={20} />
                        Quick Rewards
                    </h3>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {behaviors.map(behavior => (
                            <button
                                key={behavior.id}
                                disabled={isSubmitting}
                                onClick={() => handleAwardCoins(behavior.coin_value, behavior.label)}
                                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-center group"
                            >
                                <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                                    {/* Using emoji fallback if icon generic */}
                                    {behavior.icon === 'Star' ? '⭐' :
                                        behavior.icon === 'HandHeart' ? '🤝' :
                                            behavior.icon === 'BookCheck' ? '📚' :
                                                behavior.icon === 'Lightbulb' ? '💡' :
                                                    behavior.icon === 'CalendarCheck' ? '📅' : '👍'}
                                </span>
                                <span className="text-xs font-semibold text-slate-700 block w-full truncate">
                                    {behavior.label}
                                </span>
                                <span className="text-xs font-bold text-green-600">
                                    +{behavior.coin_value} 🪙
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                        <h4 className="text-sm font-semibold text-slate-600 mb-2">Custom Amount</h4>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={manualAmount}
                                onChange={(e) => setManualAmount(e.target.value)}
                                className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center font-bold"
                            />
                            <input
                                type="text"
                                placeholder="Reason (e.g. Extra effort)"
                                value={manualReason}
                                onChange={(e) => setManualReason(e.target.value)}
                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            />
                            <button
                                disabled={isSubmitting || !parseInt(manualAmount)}
                                onClick={() => handleAwardCoins(parseInt(manualAmount), manualReason || 'Manual adjustment')}
                                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
                            >
                                {isSubmitting ? '...' : 'Give'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Activity className="text-blue-500" size={20} />
                        Recent Activity
                    </h3>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[400px]">
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
                                        w-10 h-10 rounded-full flex items-center justify-center shrink-0
                                        ${tx.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}
                                    `}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 truncate">{tx.reason}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
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
