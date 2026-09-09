export type SetupReadDecision = { status: 200 | 404 | 503; error?: "setup_unavailable" | "operation_unavailable" };

export function decideSetupRead({ rpcFailure, workspace, officialChoices, valid }: { rpcFailure: boolean; workspace: unknown; officialChoices: unknown; valid: boolean }): SetupReadDecision {
  if (rpcFailure) return { status: 503, error: "operation_unavailable" };
  if (workspace === null && officialChoices === null) return { status: 404, error: "setup_unavailable" };
  if (!valid) return { status: 503, error: "operation_unavailable" };
  return { status: 200 };
}
