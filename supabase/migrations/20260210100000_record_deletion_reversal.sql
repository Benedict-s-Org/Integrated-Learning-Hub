-- 1. Add coin_amount to student_records
ALTER TABLE public.student_records 
ADD COLUMN IF NOT EXISTS coin_amount INTEGER DEFAULT 0;

-- 2. Create the reversal trigger function
CREATE OR REPLACE FUNCTION handle_student_record_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Only reverse if there was a coin impact and we have a student_id
    IF OLD.coin_amount != 0 AND OLD.student_id IS NOT NULL THEN
        UPDATE public.user_room_data
        SET coins = COALESCE(coins, 0) - OLD.coin_amount
        WHERE user_id = OLD.student_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger
DROP TRIGGER IF EXISTS on_student_record_deleted ON public.student_records;
CREATE TRIGGER on_student_record_deleted
BEFORE DELETE ON public.student_records
FOR EACH ROW
EXECUTE FUNCTION handle_student_record_deletion();

-- 4. Update the increment_room_coins RPC to populate coin_amount
CREATE OR REPLACE FUNCTION increment_room_coins(
    target_user_id UUID, 
    amount INTEGER,
    log_reason TEXT DEFAULT NULL,
    log_admin_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- 1. Update Balance
  UPDATE public.user_room_data
  SET coins = COALESCE(coins, 0) + amount
  WHERE user_id = target_user_id;

  -- 2. Log Activity (Historical Audit)
  IF log_reason IS NOT NULL THEN
    INSERT INTO public.coin_transactions (user_id, amount, reason, created_by)
    VALUES (target_user_id, amount, log_reason, log_admin_id);
    
    -- 3. Log to Student Records (For the new History UI)
    -- Now storing the 'amount' so it can be reversed on deletion
    INSERT INTO public.student_records (student_id, type, message, created_by, is_internal, coin_amount)
    VALUES (
        target_user_id, 
        CASE WHEN amount >= 0 THEN 'positive' ELSE 'negative' END,
        log_reason,
        log_admin_id,
        false,
        amount
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
