export function creationDateInputValue(plannedDate: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) return plannedDate;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(plannedDate);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : "";
}
export function combineLocalDateTime(date: string, time: string) {
  return date ? `${date}${time ? `T${time}` : ""}` : "";
}

// UTC is used only as a calendar, never to interpret the tournament's local time.
function calendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function tournamentDayCount(startsAt: string, endsAt: string): number | null {
  const start = calendarDate(startsAt.slice(0, 10));
  const end = calendarDate(endsAt.slice(0, 10));
  if (!start || !end || end < start) return null;
  return (end.valueOf() - start.valueOf()) / 86_400_000 + 1;
}

export function tournamentEndForDays(startDate: string, days: string): string | null {
  const start = calendarDate(startDate);
  if (!start || !/^[1-9]\d*$/.test(days) || !Number.isSafeInteger(Number(days))) return null;
  start.setUTCDate(start.getUTCDate() + Number(days) - 1);
  if (!Number.isFinite(start.valueOf()) || start.getUTCFullYear() > 9999) return null;
  return `${start.toISOString().slice(0, 10)}T23:59`;
}
