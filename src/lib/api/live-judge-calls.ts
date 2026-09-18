import { isUuid } from "./validation.ts";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);

export type LiveJudgeCallAction = "call" | "accept" | "resolve";
export type LiveJudgeCallRequest = { action: LiveJudgeCallAction; gameId: string };
export type LiveJudgeCallsWorkspace = { calls: Array<{ gameId: string; eventId: string; tableSeat: string; acceptedJudgeCount: number; assignedToMe: boolean; availableToAccept: boolean }> };

export function isLiveJudgeCallRequest(value: unknown): value is LiveJudgeCallRequest {
  return record(value) && Object.keys(value).length === 2 && ["call", "accept", "resolve"].includes(value.action as string) && isUuid(value.gameId);
}

export function isLiveJudgeCallsWorkspace(value: unknown): value is LiveJudgeCallsWorkspace {
  if (!record(value) || Object.keys(value).length !== 1 || !Array.isArray(value.calls)) return false;
  return value.calls.every((call) => record(call) && Object.keys(call).sort().join(",") === "acceptedJudgeCount,assignedToMe,availableToAccept,eventId,gameId,tableSeat"
    && isUuid(call.gameId) && isUuid(call.eventId) && typeof call.tableSeat === "string" && /^[A-Za-z0-9]+-[0-9]+$/.test(call.tableSeat)
    && Number.isSafeInteger(call.acceptedJudgeCount) && (call.acceptedJudgeCount as number) >= 0 && (call.acceptedJudgeCount as number) <= 2
    && typeof call.assignedToMe === "boolean" && typeof call.availableToAccept === "boolean");
}

type RpcClient = {
  rpc: (procedure: string, arguments_: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

export async function getLiveJudgeCalls(admin: RpcClient, actorId: string, tournamentId: string) {
  const { data, error } = await admin.rpc("get_live_judge_calls_v1", { p_actor_id: actorId, p_tournament_id: tournamentId });
  return error || !isLiveJudgeCallsWorkspace(data) ? null : data;
}

export async function changeLiveJudgeCall(admin: RpcClient, actorId: string, tournamentId: string, request: LiveJudgeCallRequest) {
  const procedure = request.action === "call" ? "open_live_judge_call_v1" : request.action === "accept" ? "accept_live_judge_call_v1" : "resolve_live_judge_call_v1";
  return admin.rpc(procedure, { p_actor_id: actorId, p_tournament_id: tournamentId, p_game_id: request.gameId });
}
