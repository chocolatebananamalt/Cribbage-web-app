const appStoragePrefixes = [
  "acc-score:",
  "acc-correction:",
  "registration-operation:",
  "registration-review-operation:",
  "manual-roster-operation:",
  "roster-csv-operation:",
  "payment-operation:",
  "payment-obligation:",
  "director-new-tournament-pending:",
  "tournament-creation-seed:",
  "expense-operation:",
  "seating-operation:",
  "event-roster-enrollment:",
  "event-schedule:",
  "event-start:",
  "playoff-outcome:",
  "settlement-v5:",
  "settlement-v5-finalization:",
  "payback-review:",
  "prize-schedule:",
  "playoff-placement:",
  "settlement-finalization:",
  "qualification-finalization:",
  "settlement-draft:",
  "tournament-setup:",
  "tournament-activation:",
  "device-recovery:",
  "hybrid-game-create:",
  "hybrid-game-review:",
  "paper-game-completion:",
  "paper-game-review:",
  "paper-official-identity:",
  "tournament-setup-amendment:",
  "event-dispute:",
  "acc:event-check-in:completion",
];

export function isAppRecoveryStorageKey(key: string) {
  return appStoragePrefixes.some(prefix => key.startsWith(prefix));
}

export function clearAppSessionStorage(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key && isAppRecoveryStorageKey(key)) storage.removeItem(key);
  }
}

/** Returns only app-owned retry records. It never inspects other sites' data. */
export function countAppSessionStorageRecords(storage: Storage) {
  let count = 0;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isAppRecoveryStorageKey(key)) count += 1;
  }
  return count;
}
