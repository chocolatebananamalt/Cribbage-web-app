/** Only a verified non-enrollment may expose the ordinary money ledger. */
export function simulationFinanceDispatch(data: unknown, failed: boolean): "legacy" | "simulation" | "blocked" {
  if (failed || !data || typeof data !== "object" || Array.isArray(data)) return "blocked";
  const value = data as Record<string, unknown>;
  if (value.status === "not_enabled" && Object.keys(value).length === 1) return "legacy";
  if (value.status === "available" && value.evidenceKind === "simulation"
    && value.moneyMoved === false && value.accountingAvailable === false
    && Array.isArray(value.sources)) return "simulation";
  return "blocked";
}
