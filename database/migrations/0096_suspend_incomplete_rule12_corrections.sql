-- Rule 12.2 includes paper-card discrepancy outcomes that may retain
-- non-reciprocal individual card values. The current shared-result correction
-- writer cannot represent every source case. Disable direct browser RPC
-- mutation until a reviewed independent-card replacement and complete fixture
-- set are ready. This is intentionally a revocation only: reenabling requires
-- an explicit, separately reviewed migration.

revoke all on function public.propose_game_correction(uuid, uuid, integer, text, integer, text, uuid) from authenticated;
revoke all on function public.review_game_correction(uuid, text, uuid) from authenticated;
