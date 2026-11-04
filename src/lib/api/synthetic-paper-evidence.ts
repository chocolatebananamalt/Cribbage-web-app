import { isUuid } from "./validation.ts";

export const syntheticPaperProjectRef = "nnhcnvksxgxnpvdqjgpg";
export const syntheticPaperNotice = "SYNTHETIC TEST SCORECARDS - no physical originals or human review are claimed.";
export type SyntheticPaperArtifact = {
  artifactId: string; gameId: string; eventId: string; gameVersion: number;
  sideA: { text: string; sha256: string; reference: string };
  sideB: { text: string; sha256: string; reference: string };
};

/** An exact backend origin AND a non-production deployment are required.
 * Database-owned fixture authorization remains an independent second gate. */
export function isSyntheticPaperDeployment(env: Record<string, string | undefined>) {
  const backendMatches = env.NEXT_PUBLIC_SUPABASE_URL === `https://${syntheticPaperProjectRef}.supabase.co`;
  const knownPreview = env.VERCEL_ENV === "preview";
  const knownLocal = ["development", "test"].includes(env.NODE_ENV ?? "")
    && (env.VERCEL_ENV === undefined || env.VERCEL_ENV === "development");
  return backendMatches && (knownPreview || knownLocal);
}

export function isSyntheticPaperArtifact(value: unknown): value is SyntheticPaperArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const a = value as Record<string, unknown>;
  if (Object.keys(a).sort().join() !== "artifactId,eventId,gameId,gameVersion,sideA,sideB"
    || !isUuid(a.artifactId) || !isUuid(a.gameId) || !isUuid(a.eventId)
    || !Number.isSafeInteger(a.gameVersion) || Number(a.gameVersion) < 1) return false;
  return (["a", "b"] as const).every(side => {
    const value = a[side === "a" ? "sideA" : "sideB"];
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const card = value as Record<string, unknown>;
    return Object.keys(card).sort().join() === "reference,sha256,text"
      && typeof card.sha256 === "string" && /^[a-f0-9]{64}$/.test(card.sha256)
      && card.reference === `SYNTHETIC-v1:${a.artifactId}:${side}:${card.sha256}`
      && typeof card.text === "string" && card.text.length <= 4096
      && card.text.startsWith("SYNTHETIC TEST SCORECARD\n")
      && card.text.includes(`Game: ${a.gameId}\n`)
      && card.text.includes(`Card side: ${side}\n`)
      && card.text.includes("No physical original; no human review claimed.\n");
  });
}

export function isSyntheticPaperWorkspace(value: unknown, tournamentId: string): value is { tournamentId: string; projectRef: string; eventIds: string[]; gameIds: string[]; artifacts: SyntheticPaperArtifact[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const w = value as Record<string, unknown>;
  return Object.keys(w).sort().join() === "artifacts,eventIds,gameIds,projectRef,tournamentId"
    && w.tournamentId === tournamentId && w.projectRef === syntheticPaperProjectRef
    && Array.isArray(w.eventIds) && w.eventIds.length > 0 && w.eventIds.every(isUuid) && new Set(w.eventIds).size === w.eventIds.length
    && Array.isArray(w.gameIds) && w.gameIds.every(isUuid) && new Set(w.gameIds).size === w.gameIds.length
    && Array.isArray(w.artifacts) && w.artifacts.every(isSyntheticPaperArtifact) && w.artifacts.every(a => (w.eventIds as string[]).includes(a.eventId) && (w.gameIds as string[]).includes(a.gameId))
    && new Set(w.artifacts.map(a => a.gameId)).size === w.artifacts.length;
}
