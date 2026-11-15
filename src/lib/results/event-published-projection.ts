import "server-only";
import { createHash } from "node:crypto";
import { isUuid } from "../api/validation.ts";
import { projectPlayerPlayoff, type PlayoffDisplayInput } from "./player-playoff-display.ts";
import type { ExistingBracketProjection } from "./player-playoff-read-model.ts";
import { isRunningPoolWorkspace, type RunningPoolWorkspace } from "./pool-running-summary.ts";

export type EventPublicationHead = {
  kind: "event-results-publication-head-v1"; tournamentId: string; eventId: string; publicationId: string; revision: number;
  state: "published" | "withdrawn"; audience: "players-and-public"; sections: ("bracket" | "pools")[]; sourceDigest: string;
};
export type EventPublicationSource = {
  kind: "event-results-publication-source-v1"; tournamentId: string; eventId: string;
  bracket: ExistingBracketProjection | null; pools: RunningPoolWorkspace | null;
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuid = (v: unknown): v is string => isUuid(v) && v === v.toLowerCase();
const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : object(v)
  ? `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}` : JSON.stringify(v) ?? "null";
function head(v: unknown): v is EventPublicationHead {
  return object(v) && exact(v, ["kind", "tournamentId", "eventId", "publicationId", "revision", "state", "audience", "sections", "sourceDigest"])
    && v.kind === "event-results-publication-head-v1" && [v.tournamentId, v.eventId, v.publicationId].every(uuid)
    && Number.isSafeInteger(v.revision) && Number(v.revision) > 0 && Number(v.revision) <= 2147483647
    && typeof v.state === "string" && ["published", "withdrawn"].includes(v.state) && v.audience === "players-and-public"
    && Array.isArray(v.sections) && v.sections.length > 0 && v.sections.length <= 2 && new Set(v.sections).size === v.sections.length
    && v.sections.every(s => s === "bracket" || s === "pools") && typeof v.sourceDigest === "string" && /^[a-f0-9]{64}$/.test(v.sourceDigest);
}
const origins = ["synthetic-event", "synthetic-indicated", "director-attested-origin-unverified", "director-reviewed-origin-unverified"];
function validated(source: unknown) {
  if (!object(source) || !exact(source, ["kind", "tournamentId", "eventId", "bracket", "pools"]) || source.kind !== "event-results-publication-source-v1"
    || ![source.tournamentId, source.eventId].every(uuid)) return null;
  let bracket: Extract<ExistingBracketProjection, { status: "available" }> | null = null;
  if (source.bracket !== null) {
    const b = source.bracket;
    if (!object(b) || b.status !== "available" || !object(b.input) || b.input.tournamentId !== source.tournamentId || b.input.eventId !== source.eventId
      || b.sourceObservation !== "matching-double-read-not-atomic" || b.publicAccessGranted !== false || b.independentPlayEstablished !== false || typeof b.origin !== "string" || !origins.includes(b.origin)) return null;
    const display = projectPlayerPlayoff(b.input);
    if (display.status !== "available") return null;
    bracket = { status: "available", input: structuredClone(b.input) as PlayoffDisplayInput,
      display, origin: b.origin as Extract<ExistingBracketProjection, { status: "available" }>["origin"], notice: "", sourceObservation: "matching-double-read-not-atomic", publicAccessGranted: false, independentPlayEstablished: false };
  }
  if (source.pools !== null && (!isRunningPoolWorkspace(source.pools) || source.pools.tournamentId !== source.tournamentId || source.pools.eventId !== source.eventId
    || source.pools.sourceObservation !== "matching-double-read-not-atomic")) return null;
  return { tournamentId: source.tournamentId as string, eventId: source.eventId as string, bracket, pools: source.pools === null ? null : structuredClone(source.pools) as RunningPoolWorkspace };
}
/** Binding includes validated input/version/observation only, not arbitrary source notes/display. */
export function eventPublicationSourceDigest(source: unknown): string | null {
  const v = validated(source); if (!v) return null;
  const b = v.bracket;
  return createHash("sha256").update(canonical({ tournamentId: v.tournamentId, eventId: v.eventId,
    bracket: b ? { input: b.input, origin: b.origin, sourceObservation: b.sourceObservation } : null, pools: v.pools })).digest("hex");
}

/** Pure proposed contract. Supplied heads/booleans are NOT a server authority or permission.
 * No public transport, publisher, grant, database read or persistence is implemented here. */
export function prepareEventPublishedProjection(expected: { tournamentId: string; eventId: string; publicationId: string; revision: number }, before: unknown, after: unknown, source: unknown) {
  const blocked = (code: string) => ({ status: "blocked" as const, code, accessGranted: false as const, transportEnabled: false as const });
  if (!expected || ![expected.tournamentId, expected.eventId, expected.publicationId].every(uuid) || !Number.isSafeInteger(expected.revision) || expected.revision < 1) return blocked("invalid_scope");
  if (!head(before) || !head(after) || before.state !== "published" || after.state !== "published") return blocked("publication_unavailable");
  if (canonical(before) !== canonical(after)) return blocked("publication_changed");
  if (before.tournamentId !== expected.tournamentId || before.eventId !== expected.eventId || before.publicationId !== expected.publicationId || before.revision !== expected.revision) return blocked("publication_scope_changed");
  const v = validated(source), digest = eventPublicationSourceDigest(source);
  if (!v || v.tournamentId !== expected.tournamentId || v.eventId !== expected.eventId || digest !== before.sourceDigest) return blocked("source_changed_or_unavailable");
  if ((!before.sections.includes("bracket") && v.bracket !== null) || (!before.sections.includes("pools") && v.pools !== null)) return blocked("section_not_published");
  if (before.sections.every(s => s === "bracket" ? v.bracket === null : v.pools === null)) return blocked("published_data_unavailable");
  const display = v.bracket?.display;
  const tournamentIdFor = (participantId: string | null) => participantId === null ? null : display?.players.find(p => p.participantId === participantId)?.tournamentId ?? null;
  const bracket = display ? {
    players: display.players.map(p => ({ tournamentId: p.tournamentId, name: p.displayName, seed: p.seed })),
    rounds: display.rounds.map(r => ({ number: r.round, label: r.label, matches: r.matches.map(m => ({ matchId: m.matchId, status: m.status,
      sides: m.sides.map(s => ({ tournamentId: s.player?.tournamentId ?? null, fromMatch: s.fromMatch, absentSeed: s.absentSeed })), winnerTournamentId: tournamentIdFor(m.winnerId) })) })),
    championTournamentId: display.champion?.tournamentId ?? null, provenance: v.bracket!.origin, independentPlayEstablished: false as const,
  } : null;
  const pools = v.pools ? { observedAt: v.pools.observedAt, currency: v.pools.currency, qState: v.pools.qState, sideState: v.pools.sideState,
    entries: v.pools.pools.map(p => ({ poolId: p.poolId, kind: p.kind, name: p.name, feeMinor: p.feeMinor, status: p.status, enteredCount: p.enteredCount,
      fullyPaidCount: p.fullyPaidCount, eligiblePaidEntryCount: p.eligiblePaidEntryCount, recordedPoolTotalMinor: p.recordedPoolTotalMinor,
      eligiblePoolTotalMinor: p.eligiblePoolTotalMinor, projectedIfAllEnteredPayMinor: p.projectedIfAllEnteredPayMinor, contributionsNeedReview: p.heldOrExcludedReviewRequired })),
    projectedAmountsAreEstimates: true as const, awardScheduleAvailable: false as const } : null;
  return { status: "prepared-not-authorized" as const, accessGranted: false as const, transportEnabled: false as const,
    data: { kind: "event-published-results-contract-v1" as const, tournamentId: expected.tournamentId, eventId: expected.eventId,
      publicationId: before.publicationId, revision: before.revision, bracket, pools, sourceObservation: "pinned-supplied-heads-not-atomic" as const } };
}
