import type { SeatingCheckIn } from "../api/seating-workspace";

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function filterCheckInByName<T extends SeatingCheckIn>(entries: readonly T[], query: string): readonly T[] {
  const term = normalized(query);
  if (!term) return entries;
  return entries.filter((entry) => normalized(entry.displayName).includes(term));
}
