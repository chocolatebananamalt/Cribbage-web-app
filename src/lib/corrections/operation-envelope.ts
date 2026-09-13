export type SessionStorageLike = { length: number; key(index: number): string | null; getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

export function proposalOperationKey(actorId: string, gameId: string) { return `acc-correction:${actorId}:proposal:${gameId}`; }
export function reviewOperationKey(actorId: string, correctionId: string) { return `acc-correction:${actorId}:review:${correctionId}`; }

export function clearOtherCorrectionActors(storage: SessionStorageLike, actorId: string) {
  const ownPrefix = `acc-correction:${actorId}:`;
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith("acc-correction:") && !key.startsWith(ownPrefix)) storage.removeItem(key);
  }
}
