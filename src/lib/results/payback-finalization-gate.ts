import type { PaybackReviewWorkspace } from "../api/payback-review.ts";

/** UI readiness only. SQL rechecks current facts and authorization on every write. */
export function canStartPaybackFinalization(
  workspace: PaybackReviewWorkspace | null,
  draft: { draftId: string; version: number } | null | undefined,
) {
  if (!workspace) return false;
  // Historical domains remain readable/usable, without being relabeled compliant.
  if (!workspace.required) return true;
  return !!draft && workspace.scope.status === "supported" && workspace.review?.current === true
    && workspace.review?.draftId === draft.draftId
    && workspace.review.draftVersion === draft.version;
}
