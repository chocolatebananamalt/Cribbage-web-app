export function parseUsdMinor(
  input: string,
  options: { allowZero?: boolean; maxMinor?: number } = {},
) {
  const value = input.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  const minimum = options.allowZero ? 0 : 1;
  const maximum = options.maxMinor ?? Number.MAX_SAFE_INTEGER;
  return Number.isSafeInteger(minor) && minor >= minimum && minor <= maximum ? minor : null;
}

export function formatUsdInput(minor: number | null) {
  return minor === null ? "" : (minor / 100).toFixed(2);
}
