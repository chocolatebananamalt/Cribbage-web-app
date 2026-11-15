-- The incomplete Rule 12 correction feature is intentionally absent. Remove
-- its direct authenticated read RPCs as well as its writers so an API caller
-- cannot use correction workspaces or replay receipts while the feature is
-- release-gated. A future reviewed migration must explicitly restore only the
-- least-privileged functions required by the independent-card replacement.

revoke all on function public.get_correction_workspace(uuid) from authenticated;
revoke all on function public.get_correction_operation_reconciliation(uuid, uuid) from authenticated;
revoke all on function public.get_correction_policy(uuid) from authenticated;
revoke all on function public.get_correction_policy_operation_reconciliation(uuid, uuid) from authenticated;
