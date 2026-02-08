import React, { useEffect, useState } from 'react';
import { Check, X, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PendingReward {
    id: string;
    target_user_id: string;
    amount: number;
    reason: string;
    submitted_at: string;
    status: string;
    target_user?: {
        display_name: string;
        avatar_url?: string;
    };
}

interface PendingRewardsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProcessed: () => void;
}

export function PendingRewardsModal({ isOpen, onClose, onProcessed }: PendingRewardsModalProps) {
    const [rewards, setRewards] = useState<PendingReward[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchPendingRewards();
        }
    }, [isOpen]);

    const fetchPendingRewards = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('pending_rewards' as any)
                .select(`
                    *,
                    target_user:users(display_name)
                `)
                .eq('status', 'pending')
                .order('submitted_at', { ascending: false });

            if (error) throw error;

            setRewards(data as any || []);
        } catch (err) {
            console.error('Error fetching pending rewards:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (reward: PendingReward) => {
        try {
            // 1. Give Coins
            const { error: rpcError } = await (supabase.rpc as any)('increment_room_coins', {
                target_user_id: reward.target_user_id,
                amount: reward.amount,
                log_reason: reward.reason || 'Guest Reward Request',
                log_admin_id: (await supabase.auth.getUser()).data.user?.id
            });
            if (rpcError) throw rpcError;

            // 2. Mark as Approved
            const { error: updateError } = await supabase
                .from('pending_rewards' as any)
                .update({ status: 'approved', processed_at: new Date().toISOString() } as any)
                .eq('id', reward.id);

            if (updateError) throw updateError;

            setRewards(prev => prev.filter(r => r.id !== reward.id));
            onProcessed();
        } catch (err) {
            console.error('Error approving reward:', err);
            alert('Failed to approve');
        }
    };

    const handleReject = async (reward: PendingReward) => {
        try {
            // Mark as Rejected
            const { error: updateError } = await supabase
                .from('pending_rewards' as any)
                .update({ status: 'rejected', processed_at: new Date().toISOString() } as any)
                .eq('id', reward.id);

            if (updateError) throw updateError;

            setRewards(prev => prev.filter(r => r.id !== reward.id));
            onProcessed();
        } catch (err) {
            console.error('Error rejecting reward:', err);
            alert('Failed to reject');
        }
    };

    const handleApproveAll = async () => {
        if (!confirm(`Approve all ${rewards.length} requests?`)) return;
        setIsProcessing(true);
        try {
            for (const reward of rewards) {
                await handleApprove(reward);
            }
            onClose();
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Clock className="text-orange-500" />
                            Pending Approvals
                        </h2>
                        <p className="text-sm text-gray-500">
                            {rewards.length} request{rewards.length !== 1 ? 's' : ''} waiting
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isLoading ? (
                        <div className="text-center p-8 text-gray-400">Loading...</div>
                    ) : rewards.length === 0 ? (
                        <div className="text-center p-12 text-gray-400 flex flex-col items-center gap-3">
                            <Check className="w-12 h-12 text-green-200" />
                            <p>All caught up! No pending requests.</p>
                        </div>
                    ) : (
                        rewards.map(reward => (
                            <div key={reward.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                                        ${reward.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {reward.amount > 0 ? '+' : ''}{reward.amount}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-800 truncate">
                                            {reward.target_user?.display_name || 'Unknown User'}
                                        </p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                                {reward.reason}
                                            </span>
                                            <span>•</span>
                                            <span>
                                                {new Date(reward.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => handleReject(reward)}
                                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                        title="Reject"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleApprove(reward)}
                                        className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                        title="Approve"
                                    >
                                        <Check size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {rewards.length > 0 && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                            Bulk Actions
                        </span>
                        <button
                            onClick={handleApproveAll}
                            disabled={isProcessing}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-blue-200"
                        >
                            {isProcessing ? 'Processing...' : 'Approve All'}
                            <ArrowRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
