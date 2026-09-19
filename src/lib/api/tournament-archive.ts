import { isUuid } from "./validation.ts";

export type ArchiveTournamentRequest =
  | { action: "archive"; reason: string; idempotencyKey: string }
  | { action: "restore"; idempotencyKey: string };

export type TournamentArchiveResult =
  | { status: "tournament_archived"; tournamentId: string; tournamentName: string; previousStatus: string }
  | { status: "tournament_restored"; tournamentId: string; tournamentName: string; restoredStatus: string }
  | { status: "already_archived"; tournamentId: string }
  | { status: "not_archived"; tournamentId: string }
  | { status: "rejected"; code: string };

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function isArchiveTournamentRequest(value: unknown): value is ArchiveTournamentRequest {
  if (!record(value) || !isUuid(value.idempotencyKey)) return false;
  if (value.action === "restore") return Object.keys(value).length === 2;
  // Archiving a tournament removes it from every director's chooser, so it
  // carries a required reason the same way a retire or a roster withdrawal
  // does. Restoring is the undo and needs no justification.
  return value.action === "archive"
    && Object.keys(value).length === 3
    && typeof value.reason === "string"
    && value.reason.trim().length > 0
    && value.reason.trim().length <= 1000;
}

export function isTournamentArchiveResult(value: unknown): value is TournamentArchiveResult {
  if (!record(value) || typeof value.status !== "string") return false;
  if (value.status === "rejected") return typeof value.code === "string";
  if (value.status === "tournament_archived") return isUuid(value.tournamentId) && typeof value.tournamentName === "string" && typeof value.previousStatus === "string";
  if (value.status === "tournament_restored") return isUuid(value.tournamentId) && typeof value.tournamentName === "string" && typeof value.restoredStatus === "string";
  return (value.status === "already_archived" || value.status === "not_archived") && isUuid(value.tournamentId);
}

export function archiveRejectionMessage(code: string) {
  if (code === "primary_director_required") return "Only the tournament's primary director can archive it.";
  if (code === "tournament_unavailable") return "That tournament is no longer available.";
  if (code === "idempotency_conflict") return "A different operation is already using this request id. Reload and try again.";
  return "The tournament could not be archived. Reload and try again.";
}
