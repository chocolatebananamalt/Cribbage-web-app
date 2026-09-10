/**
 * Rule 12.2 paper-card discrepancy resolution cannot be enabled until its
 * independent-card data model and all source cases have executable evidence.
 * A default-off gate keeps the incomplete correction writer absent from the
 * application boundary; a matching database migration removes its direct RPC
 * grants from the pilot until a reviewed replacement is ready.
 */
export function rule12CorrectionEnabled(_env: Record<string, string | undefined> = process.env) {
  // The replacement model is intentionally not a releasable feature yet.
  // A future release decision must replace this hard stop with its reviewed
  // evidence gate; an environment edit alone must never publish it.
  void _env;
  return false;
}
