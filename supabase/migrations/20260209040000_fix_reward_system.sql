-- 1. Redefine increment_room_coins with UPSERT and consistent signature
-- This ensures students have a coin record before we try to update it.
CREATE OR REPLACE FUNCTION public.increment_room_coins(
    target_user_id UUID,
    amount INTEGER,
    log_reason TEXT DEFAULT 'Gift',
    log_admin_id UUID DEFAULT auth.uid()
)
RETURNS VOID AS $$
BEGIN
    -- Ensure user has a record in user_room_data
    INSERT INTO public.user_room_data (user_id, coins)
    VALUES (target_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Update coins
    UPDATE public.user_room_data
    SET coins = COALESCE(coins, 0) + amount,
        updated_at = NOW()
    WHERE user_id = target_user_id;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by)
    VALUES (target_user_id, amount, log_reason, log_admin_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to reset ALL coins for all users
-- Useful for starting a new term or fixing major errors.
CREATE OR REPLACE FUNCTION public.reset_all_coins()
RETURNS VOID AS $$
BEGIN
    -- Optional: Move current coins to a 'resetlog' if you wanted history, 
    -- but user said "reset", so we'll just zero them out.
    
    UPDATE public.user_room_data
    SET coins = 0,
        updated_at = NOW();

    -- Log global reset (optional, but good for auditing)
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by)
    SELECT id, -coins, 'Global Reset', auth.uid()
    FROM public.user_room_data
    WHERE coins != 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to revert a specific transaction
-- Automatically adjusts the user's coin balance back.
CREATE OR REPLACE FUNCTION public.revert_coin_transaction(transaction_id UUID)
RETURNS VOID AS $$
DECLARE
    target_user UUID;
    coin_amt INTEGER;
BEGIN
    -- Get transaction info
    SELECT user_id, amount INTO target_user, coin_amt
    FROM public.coin_transactions
    WHERE id = transaction_id;

    IF FOUND THEN
        -- Subtract the awarded amount (negative of amount)
        UPDATE public.user_room_data
        SET coins = COALESCE(coins, 0) - coin_amt,
            updated_at = NOW()
        WHERE user_id = target_user;

        -- Delete the transaction
        DELETE FROM public.coin_transactions WHERE id = transaction_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
