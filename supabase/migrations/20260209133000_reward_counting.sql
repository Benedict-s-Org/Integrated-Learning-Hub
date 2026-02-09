-- Add new columns for tracking reward limits
ALTER TABLE public.user_room_data
ADD COLUMN IF NOT EXISTS virtual_coins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_counts JSONB DEFAULT '{}'::jsonb;

-- Update the increment_room_coins function to handle daily limits
CREATE OR REPLACE FUNCTION public.increment_room_coins(
    target_user_id UUID,
    amount INTEGER,
    log_reason TEXT DEFAULT 'Gift',
    log_admin_id UUID DEFAULT auth.uid()
)
RETURNS VOID AS $$
DECLARE
    current_date TEXT;
    current_counts JSONB;
    daily_usage INTEGER;
    daily_real_earned INTEGER;
    is_answering_question BOOLEAN;
    final_amount INTEGER;
    is_virtual BOOLEAN;
BEGIN
    -- Initialize variables
    current_date := to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD'); -- Use HK time for daily resets
    is_answering_question := log_reason LIKE '%回答問題%';
    final_amount := amount;
    is_virtual := FALSE;

    -- Ensure user has a record
    INSERT INTO public.user_room_data (user_id, coins, virtual_coins, daily_counts)
    VALUES (target_user_id, 0, 0, '{}'::jsonb)
    ON CONFLICT (user_id) DO NOTHING;

    -- Get current counts
    SELECT daily_counts INTO current_counts
    FROM public.user_room_data
    WHERE user_id = target_user_id;

    -- Initialize daily real earned tracking
    IF (current_counts->>'date') = current_date THEN
        daily_usage := COALESCE((current_counts->>'count')::INTEGER, 0);
        daily_real_earned := COALESCE((current_counts->>'real_earned')::INTEGER, 0);
    ELSE
        daily_usage := 0;
        daily_real_earned := 0;
    END IF;

    -- Handle "Answering Questions" Logic
    IF is_answering_question AND amount > 0 THEN
        -- Logic: First 3 times (0, 1, 2) are real coins. 4th and beyond are virtual.
        IF daily_usage < 3 THEN
            -- Real Coins
            daily_real_earned := daily_real_earned + amount;
            UPDATE public.user_room_data
            SET coins = COALESCE(coins, 0) + final_amount,
                daily_counts = jsonb_build_object('date', current_date, 'count', daily_usage + 1, 'real_earned', daily_real_earned),
                updated_at = NOW()
            WHERE user_id = target_user_id;
        ELSE
            -- Virtual Coins
            is_virtual := TRUE;
            UPDATE public.user_room_data
            SET virtual_coins = COALESCE(virtual_coins, 0) + final_amount,
                daily_counts = jsonb_build_object('date', current_date, 'count', daily_usage + 1, 'real_earned', daily_real_earned),
                updated_at = NOW()
            WHERE user_id = target_user_id;
        END IF;

    ELSE
        -- Standard behavior for other rewards or penalties (amount < 0)
        IF amount > 0 THEN
            daily_real_earned := daily_real_earned + amount;
        END IF;

        UPDATE public.user_room_data
        SET coins = COALESCE(coins, 0) + final_amount,
            daily_counts = jsonb_build_object('date', current_date, 'count', daily_usage, 'real_earned', daily_real_earned),
            updated_at = NOW()
        WHERE user_id = target_user_id;
    END IF;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by)
    VALUES (
        target_user_id, 
        final_amount, 
        CASE WHEN is_virtual THEN log_reason || ' (Virtual)' ELSE log_reason END, 
        log_admin_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
