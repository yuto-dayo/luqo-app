-- ============================================================
-- 逆仕訳が売上集計に反映されるように修正
-- このSQLをSupabaseのSQLエディタで実行してください
-- ============================================================

-- 会計集計関数を修正（逆仕訳のマイナス金額を含めて集計）
CREATE OR REPLACE FUNCTION get_accounting_stats(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_sales numeric;
  total_expenses numeric;
BEGIN
  -- 売上集計（逆仕訳のマイナス金額も含める - 自動的に相殺される）
  SELECT coalesce(sum((payload->>'amount')::numeric), 0) INTO total_sales
  FROM events
  WHERE kind = 'accounting_sale_registered'
    AND created_at >= start_date AND created_at < end_date;
    -- 逆仕訳（isReversal: true）はマイナス金額で作成されるため、集計に含めれば自動的に相殺される

  -- 経費集計（承認済みまたは審議中、逆仕訳のマイナス金額も含める）
  SELECT coalesce(sum((payload->>'amount')::numeric), 0) INTO total_expenses
  FROM events
  WHERE kind = 'accounting_expense_registered'
    AND (payload->>'status' = 'approved' OR payload->>'status' = 'pending_vote')
    AND created_at >= start_date AND created_at < end_date;
    -- 逆仕訳（isReversal: true）はマイナス金額で作成されるため、集計に含めれば自動的に相殺される

  RETURN json_build_object('sales', total_sales, 'expenses', total_expenses);
END;
$$;
