-- The five-argument hash-based payment reconciliation reader was superseded
-- by the identity-bound reader in 0046. The current application does not call
-- it. Retire browser execution so one payment-recovery contract remains.

revoke all on function public.get_roster_payment_operation_reconciliation(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
