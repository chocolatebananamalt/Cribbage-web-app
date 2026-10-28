export function parseUsdMinor(
  input: string,
  options: { allowZero?: boolean; maxMinor?: number } = {},
) {
  const value = input.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match || match[1].length > 14) return null;
  const exactMinor = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const minimum = options.allowZero ? 0 : 1;
  const maximum = options.maxMinor ?? Number.MAX_SAFE_INTEGER;
  return exactMinor >= BigInt(minimum) && Number.isSafeInteger(maximum) && exactMinor <= BigInt(maximum) ? Number(exactMinor) : null;
}

export function formatUsdInput(minor: number | null) {
  if (minor === null || !Number.isSafeInteger(minor)) return "";
  const amount = BigInt(minor), absolute = amount < BigInt(0) ? -amount : amount;
  return `${amount < BigInt(0) ? "-" : ""}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}

/** USD display only: integer minor-unit storage and arithmetic stay unchanged. */
export function formatUsd(minor: number) {
  const decimal = formatUsdInput(minor);
  if (!decimal) return "Amount unavailable";
  const negative = decimal.startsWith("-");
  const [whole, fraction] = (negative ? decimal.slice(1) : decimal).split(".");
  return `${negative ? "-" : ""}$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
