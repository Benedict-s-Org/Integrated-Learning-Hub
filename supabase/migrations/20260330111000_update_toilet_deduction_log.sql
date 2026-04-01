-- Update toilet deduction to correctly log coin_amount and remaining balance in student_records
CREATE OR REPLACE FUNCTION deduct_toilet_coins(
    p_user_id UUID,
    p_amount INTEGER
) RETURNS void AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    -- Deduct toilet_coins, ensuring it doesn't go below 0 (though frontend blocks it)
    UPDATE public.user_room_data
    SET toilet_coins = GREATEST(0, COALESCE(toilet_coins, 100) - p_amount),
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING toilet_coins INTO v_new_balance;

    -- Log transaction for audit (as a consequence)
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by)
    VALUES (p_user_id, -p_amount, 'Toilet/Break', auth.uid());

    -- Log student record with coin_amount and balance in message
    INSERT INTO public.student_records (student_id, type, message, coin_amount, created_by)
    VALUES (p_user_id, 'neutral', 'Toilet/Break (剩餘: ' || v_new_balance || ')', -p_amount, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
