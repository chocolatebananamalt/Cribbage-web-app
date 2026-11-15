-- The three-argument recovery function predates exact operation/hash binding.
-- Retire it rather than leave a weaker callable path for future application code.
revoke all on function public.get_roster_payment_operation_reconciliation(uuid,uuid,uuid)
  from public, anon, authenticated;

drop function public.get_roster_payment_operation_reconciliation(uuid,uuid,uuid);
