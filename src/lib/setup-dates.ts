export function creationDateInputValue(plannedDate: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) return plannedDate;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(plannedDate);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : "";
}
export function combineLocalDateTime(date: string, time: string) {
  return date ? `${date}${time ? `T${time}` : ""}` : "";
}
