CREATE OR REPLACE FUNCTION public.get_anomalous_coin_records()
RETURNS TABLE (
  source TEXT,
  record_id UUID,
  student_id UUID,
  amount INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'coin_transactions'::TEXT,
    coin_transactions.id,
    coin_transactions.user_id,
    coin_transactions.amount,
    coin_transactions.reason,
    coin_transactions.created_at
  FROM public.coin_transactions
  WHERE ABS(coin_transactions.amount) % 10 != 0;

  RETURN QUERY
  SELECT
    'student_records'::TEXT,
    student_records.id,
    student_records.student_id,
    student_records.coin_amount,
    student_records.message,
    student_records.created_at
  FROM public.student_records
  WHERE ABS(student_records.coin_amount) % 10 != 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
