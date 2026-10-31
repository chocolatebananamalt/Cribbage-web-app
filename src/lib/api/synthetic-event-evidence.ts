import { isUuid } from "./validation.ts";
import { syntheticPaperProjectRef } from "./synthetic-paper-evidence.ts";
export const syntheticEventNotice = "SYNTHETIC TOURNAMENT REHEARSAL - simulated results and ledger only; no physical play, human review or actual money received is claimed.";
export const syntheticLedgerMemo = "TEST ONLY SYNTHETIC:";
export type SyntheticEventArtifact = { artifactId: string; eventId: string; kind: "qualification_tie" | "playoff" | "close"; sourceDigest: string; payload: Record<string, unknown>; text: string; sha256: string; reference: string };
export type SyntheticEventContext = { tournamentId: string; projectRef: string; eventIds: string[]; artifacts: SyntheticEventArtifact[]; actualMoneyReceived: false; physicalPlay: false; humanReviewClaimed: false };
export function syntheticEventArtifactId(reference: unknown): string | null {
  if (typeof reference !== "string") return null;
  const match = /SYNTHETIC-EVENT-v1:([a-f0-9-]{36}):[a-f0-9]{64}(?::[1-4])?/.exec(reference);
  return match && isUuid(match[1]) ? match[1] : null;
}
function artifactPayload(value: Record<string, unknown>, kind: string, sourceDigest: string) {
  const keys=Object.keys(value).sort().join();
  if(kind==="qualification_tie")return keys==="expectedSourceFingerprint,method,participantIds,winnerId"&&value.expectedSourceFingerprint===sourceDigest
    &&["head_to_head","one_game_playoff"].includes(value.method as string)&&Array.isArray(value.participantIds)&&value.participantIds.length===2
    &&value.participantIds.every(isUuid)&&new Set(value.participantIds).size===2&&isUuid(value.winnerId)&&value.participantIds.includes(value.winnerId);
  if(kind==="playoff")return keys==="expectedVersion,qualificationResultVersionId,series,sourceDigest"&&value.sourceDigest===sourceDigest
    &&isUuid(value.qualificationResultVersionId)&&Number.isSafeInteger(value.expectedVersion)&&Number(value.expectedVersion)>=0&&Number(value.expectedVersion)<256
    &&Array.isArray(value.series)&&value.series.length===4&&value.series.every(s=>!!s&&typeof s==="object"&&!Array.isArray(s)
      &&Object.keys(s).sort().join()==="loserId,winnerId"&&isUuid(s.winnerId)&&isUuid(s.loserId)&&s.winnerId!==s.loserId);
  return keys==="legacyVerifiedGamesWithoutStructuredProof,scheduledGames,structuredSyntheticGames,verifiedGames"
    &&Object.values(value).every(n=>Number.isSafeInteger(n)&&Number(n)>=0)&&Number(value.verifiedGames)>0&&value.scheduledGames===value.verifiedGames
    &&Number(value.structuredSyntheticGames)+Number(value.legacyVerifiedGamesWithoutStructuredProof)===value.verifiedGames;
}
export function isSyntheticEventContext(value: unknown, tournamentId: string): value is SyntheticEventContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const w = value as Record<string, unknown>;
  return Object.keys(w).sort().join() === "actualMoneyReceived,artifacts,eventIds,humanReviewClaimed,physicalPlay,projectRef,tournamentId"
    && w.tournamentId === tournamentId && w.projectRef === syntheticPaperProjectRef
    && w.actualMoneyReceived === false && w.physicalPlay === false && w.humanReviewClaimed === false
    && Array.isArray(w.eventIds) && w.eventIds.length > 0 && w.eventIds.every(isUuid) && new Set(w.eventIds).size === w.eventIds.length
    && Array.isArray(w.artifacts) && w.artifacts.every(a => {
      if (!a || typeof a !== "object" || Array.isArray(a)) return false;
      const x = a as Record<string, unknown>;
      return Object.keys(x).sort().join() === "artifactId,eventId,kind,payload,reference,sha256,sourceDigest,text"
        && isUuid(x.artifactId) && isUuid(x.eventId) && (w.eventIds as string[]).includes(x.eventId)
        && ["qualification_tie", "playoff", "close"].includes(x.kind as string)
        && typeof x.sourceDigest === "string" && /^[a-f0-9]{64}$/.test(x.sourceDigest)
        && typeof x.sha256 === "string" && /^[a-f0-9]{64}$/.test(x.sha256)
        && x.reference === `SYNTHETIC-EVENT-v1:${x.artifactId}:${x.sha256}`
        && typeof x.text === "string" && x.text.startsWith("SYNTHETIC EVENT EVIDENCE\n") && x.text.length < 16000
        && !!x.payload && typeof x.payload === "object" && !Array.isArray(x.payload)&&artifactPayload(x.payload as Record<string,unknown>,x.kind as string,x.sourceDigest);
    })&&new Set(w.artifacts.map(a=>a.artifactId)).size===w.artifacts.length;
}
