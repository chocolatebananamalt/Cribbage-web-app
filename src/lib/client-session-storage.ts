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
];

export function clearAppSessionStorage(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key && appStoragePrefixes.some((prefix) => key.startsWith(prefix))) storage.removeItem(key);
  }
}

/** Returns only app-owned retry records. It never inspects other sites' data. */
export function countAppSessionStorageRecords(storage: Storage) {
  let count = 0;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && appStoragePrefixes.some((prefix) => key.startsWith(prefix))) count += 1;
  }
  return count;
}
