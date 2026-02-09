-- Update reset_all_coins to also clear transaction history
-- This addresses the user request to "clean all the record of recently activity"
CREATE OR REPLACE FUNCTION public.reset_all_coins()
RETURNS VOID AS $$
BEGIN
    -- 1. Zero out all user balances in user_room_data
    UPDATE public.user_room_data
    SET coins = 0,
        updated_at = NOW();

    -- 2. Clear all transaction history from coin_transactions
    -- This removes mistaken records entirely as requested
    DELETE FROM public.coin_transactions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function defined above. Use via RPC or button click, not automatically in migration.
