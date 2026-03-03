import { supabase } from '@/integrations/supabase/client';
import { getHKTodayString } from '@/utils/dateUtils';

interface AwardResult {
    success: boolean;
    error?: any;
    virtualAwarded?: boolean;
}

/**
 * Centrally managed service for awarding coins and logging events.
 */
export const coinService = {
    // Track the last batch ID per session for Undo
    _lastBatchId: null as string | null,

    /**
     * Award coins to a student and log the record.
     * Handles positive rewards, negative consequences, and 'Answering Questions' virtual logic.
     */
    async awardCoins(params: {
        userId: string;
        amount: number;
        reason: string;
        type: 'reward' | 'consequence';
        adminId?: string;
        batchId?: string;
        skipDailyCount?: boolean;
    }): Promise<AwardResult> {
        const { userId, amount, reason, type, adminId, batchId, skipDailyCount } = params;

        // If a batchId is provided, track it as the most recent action
        if (batchId) {
            this._lastBatchId = batchId;
        }

        try {
            // 1. Log the record officially to student_records (for ticker)
            const displayAmount = amount >= 0 ? `+${amount}` : `${amount}`;

            // Map types to DB schema
            const dbType: "positive" | "neutral" | "negative" =
                type === 'reward' ? 'positive' : 'negative';

            const { error: logError } = await supabase
                .from('student_records')
                .insert({
                    student_id: userId,
                    type: dbType,
                    message: `${reason} (${displayAmount})`,
                    coin_amount: amount,
                    created_at: new Date().toISOString()
                } as any); // Cast as any if schema in types.ts is stale

            if (logError) console.error('Failed to log student record:', logError);

            // 2. Update the student's coins in the DB via RPC
            const { error: rpcError } = await supabase.rpc('increment_room_coins' as any, {
                target_user_id: userId,
                amount: amount,
                log_reason: reason,
                log_admin_id: adminId,
                p_batch_id: batchId,
                p_skip_daily_count: skipDailyCount
            });

            if (rpcError) {
                console.error('RPC Error awarding coins:', rpcError);
                return { success: false, error: rpcError };
            }

            return { success: true };
        } catch (err) {
            console.error('Unexpected error in awardCoins:', err);
            return { success: false, error: err };
        }
    },

    /**
     * Revert the most recent batch of transactions.
     */
    async revertLastAction(): Promise<AwardResult> {
        let batchToRevert = this._lastBatchId;

        // If memory is empty (e.g. after refresh), try to fetch the latest batch from DB
        if (!batchToRevert) {
            try {
                const { data } = await supabase
                    .from('coin_transactions' as any)
                    .select('batch_id')
                    .not('batch_id', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (data && (data as any[]).length > 0) {
                    batchToRevert = (data as any[])[0].batch_id;
                }
            } catch (err) {
                console.error('Failed to fetch latest batch_id from DB:', err);
            }
        }

        if (!batchToRevert) {
            return { success: false, error: { message: 'No action to undo or no recent transactions found.' } };
        }

        try {
            const { error } = await supabase.rpc('revert_coin_batch' as any, {
                p_batch_id: batchToRevert
            });

            if (error) throw error;

            // Clear the last batch ID after successful revert
            this._lastBatchId = null;
            return { success: true };
        } catch (err) {
            console.error('Failed to revert coin batch:', err);
            return { success: false, error: err };
        }
    },

    /**
     * Specialized logic for 'Answering Questions' (+10 coins).
     * Handles the 3-time daily limit for real coins vs virtual coins.
     */
    async awardAnsweringQuestion(userId: string): Promise<AwardResult> {
        try {
            // 1. Check daily count
            const today = getHKTodayString();
            const { data: roomData } = await supabase
                .from('user_room_data' as any)
                .select('daily_counts')
                .eq('user_id', userId)
                .single();

            const dailyCounts = (roomData as any)?.daily_counts;
            const currentRealCount = (dailyCounts?.date === today) ? (dailyCounts?.real_earned_count || 0) : 0;

            if (currentRealCount >= 3) {
                // Award virtual coins (Log only, don't use increment_room_coins RPC if we want to bypass real wallet)
                // Actually, the backend RPC might already handle this, but let's be explicit if we want standard behavior.
                // Looking at the existing codebase, it seems they just call the same RPC and the backend handles it?
                // Let's re-verify the RPC logic if possible, or just follow the established pattern.

                // Established pattern in ClassDashboardPage.tsx:
                // It still calls increment_room_coins, and the RPC handles virtual split.
                return this.awardCoins({
                    userId,
                    amount: 10,
                    reason: '回答問題',
                    type: 'reward'
                });
            }

            return this.awardCoins({
                userId,
                amount: 10,
                reason: '回答問題',
                type: 'reward'
            });
        } catch (err) {
            return { success: false, error: err };
        }
    }
};
