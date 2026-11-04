export type ScoreDraftIdentity = { actorId: string; tournamentId: string; eventId: string; gameId: string; side: "a" | "b" };
export type ScoreEntryDraft = ScoreDraftIdentity & { version: 1; revision: number; winner: "player" | "opponent" | null; marginText: string };
export function scoreEntryDraftKey(identity: ScoreDraftIdentity) {
  return `acc-score:${identity.actorId}:${identity.tournamentId}:${identity.eventId}:${identity.gameId}:${identity.side}:unsubmitted-draft`;
}
/** Only raw choices, never a submission, confirmation or verified score. */
type DraftStorage = Pick<Storage, "getItem" | "key" | "length">;
function validDraft(raw: string | null, identity: ScoreDraftIdentity): ScoreEntryDraft | null {
  try {
    if (!raw) return null;
    const draft = JSON.parse(raw) as ScoreEntryDraft;
    if (!draft || typeof draft !== "object" || Object.keys(draft).length !== 9 || draft.version !== 1 || !Number.isSafeInteger(draft.revision) || draft.revision < 1
      || !["player", "opponent", null].includes(draft.winner) || typeof draft.marginText !== "string" || !/^\d{0,3}$/.test(draft.marginText)
      || !Object.entries(identity).every(([key, value]) => draft[key as keyof ScoreDraftIdentity] === value)) return null;
    return draft;
  } catch { return null; }
}
function records(storage: DraftStorage, identity: ScoreDraftIdentity) {
  const prefix = scoreEntryDraftKey(identity) + ":";
  const entries: { key: string; draft: ScoreEntryDraft }[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const draft = validDraft(storage.getItem(key), identity);
    if (draft && key === prefix + draft.revision) entries.push({ key, draft });
  }
  return entries;
}
export function readScoreEntryDraft(storage: DraftStorage, identity: ScoreDraftIdentity): ScoreEntryDraft | null {
  try { return records(storage, identity).sort((a, b) => b.draft.revision - a.draft.revision)[0]?.draft ?? null; }
  catch { return null; }
}
/** Call only after a new guarded immutable snapshot or the durable submission exists. */
export function clearScoreEntryDraft(storage: DraftStorage & Pick<Storage, "removeItem">, identity: ScoreDraftIdentity, keepKey?: string) {
  for (const entry of records(storage, identity)) if (entry.key !== keepKey) storage.removeItem(entry.key);
}
