CREATE OR REPLACE FUNCTION deduct_toilet_coins(
    p_user_id UUID,
    p_amount INTEGER
) RETURNS void AS $$
BEGIN
    -- Deduct toilet_coins, ensuring it doesn't go below 0 (though frontend blocks it)
    UPDATE public.user_room_data
    SET toilet_coins = GREATEST(0, COALESCE(toilet_coins, 100) - p_amount),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Log transaction for audit (as a consequence)
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by)
    VALUES (p_user_id, -p_amount, 'Toilet/Break', auth.uid());

    -- Log student record as 'neutral' so it doesn't trigger "Broadcast/Consequence" bars
    INSERT INTO public.student_records (student_id, type, message, created_by)
    VALUES (p_user_id, 'neutral', 'Toilet/Break', auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
