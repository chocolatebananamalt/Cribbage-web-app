import { isUuid } from "../api/validation.ts";
import { isSeatingWorkspace } from "../api/seating-workspace.ts";
import { isReviewedDrawPublicationRequest } from "./reviewed-draw-publication.ts";
import { readReviewedDrawPublicationOperation } from "./reviewed-draw-publication-result.ts";

/** Read-only navigation proof, not schedule approval or permission to publish.
 * Never substitutes the latest draw for the exact remembered operation. */
export function reviewedDrawScheduleOperationId(value: unknown, actorId: string, tournamentId: string, operationId: string, native: unknown): string | null {
  if (!isUuid(operationId) || operationId !== operationId.toLowerCase() || !isSeatingWorkspace(native)
    || !native.registrationClosed || !native.publication || !value || typeof value !== "object" || Array.isArray(value)
    || !("request" in value) || !isReviewedDrawPublicationRequest(value.request)) return null;
  const outcome = readReviewedDrawPublicationOperation(value, { actorId, tournamentId, request: value.request });
  if (outcome.kind !== "accepted" || outcome.receipt.operationId !== operationId
    || outcome.receipt.publicationId !== native.publication.publicationId
    || native.publication.tableCount !== 1 || native.publication.seatsPerTable !== 18) return null;
  const assignments = outcome.receipt.request.reviewedCandidate.assignments;
  if (native.publication.assignments.length !== assignments.length || native.publication.assignments.some(saved =>
    !assignments.some(expected => expected.participantId === saved.rosterEntryId
      && expected.tournamentId === saved.verificationId && saved.initialTableSeat === saved.verificationId))) return null;
  return operationId;
}
