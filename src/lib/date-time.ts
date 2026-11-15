export function formatUtcDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
