/**
 * Rule 12.2 paper-card discrepancy resolution cannot be enabled until its
 * independent-card data model and all source cases have executable evidence.
 * A default-off gate keeps the incomplete correction writer absent from the
 * application boundary; a matching database migration removes its direct RPC
 * grants from the pilot until a reviewed replacement is ready.
 */
export function rule12CorrectionEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ACC_RULE12_CORRECTION_ENABLED === "approved";
}
