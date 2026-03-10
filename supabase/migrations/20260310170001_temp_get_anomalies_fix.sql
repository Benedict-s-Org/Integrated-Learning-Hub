-- Temp RPC to find anomalous coins
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
    'coin_transactions'::TEXT AS source,
    id AS record_id,
    user_id AS student_id,
    amount AS amount,
    reason AS reason,
    coin_transactions.created_at AS created_at
  FROM public.coin_transactions
  WHERE ABS(coin_transactions.amount) % 10 NOT IN (0);

  RETURN QUERY
  SELECT
    'student_records'::TEXT AS source,
    student_records.id AS record_id,
    student_records.student_id AS student_id,
    student_records.coin_amount AS amount,
    student_records.message AS reason,
    student_records.created_at AS created_at
  FROM public.student_records
  WHERE ABS(student_records.coin_amount) % 10 NOT IN (0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
