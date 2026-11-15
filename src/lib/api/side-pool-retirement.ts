import { isUuid } from "./validation.ts";
import type { SidePool, SidePoolTeamBeneficiary } from "./side-pools.ts";

// Retiring a Side Pool is deliberately its own request type and its own route
// rather than another action on the side-pools mutation union. That union is
// shared by eight money operations and is validated with an exact key match, so
// widening it for a ninth would put a removal path inside the type guard every
// election and payout already depends on.
export type RetireSidePoolRequest = { eventId: string; poolId: string; reason: string; idempotencyKey: string };

export type SidePoolActivity = {
  elections: number; teamElections: number; payouts: number;
  teamPayouts: number; policies: number; reconciliations: number; collectedMinor: number;
};

export type SidePoolRetirementResult =
  | { status: "side_pool_retired"; poolId: string; eventId: string; displayName: string; version: number }
  | { status: "side_pool_already_retired"; poolId: string; eventId: string }
  | { status: "rejected"; code: string; activity?: SidePoolActivity };

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function isRetireSidePoolRequest(value: unknown): value is RetireSidePoolRequest {
  return record(value)
    && Object.keys(value).length === 4
    && isUuid(value.eventId) && isUuid(value.poolId) && isUuid(value.idempotencyKey)
    // Removing a pool a director configured is a correction, and every other
    // correction in this system records why. The bound matches the 500
    // characters the RPC accepts.
    && typeof value.reason === "string"
    && value.reason.trim().length > 0
    && value.reason.trim().length <= 500;
}

export function isSidePoolRetirementResult(value: unknown): value is SidePoolRetirementResult {
  if (!record(value) || typeof value.status !== "string") return false;
  if (value.status === "rejected") return typeof value.code === "string";
  if (value.status === "side_pool_retired") {
    return isUuid(value.poolId) && isUuid(value.eventId)
      && typeof value.displayName === "string"
      && Number.isSafeInteger(value.version) && (value.version as number) > 1;
  }
  return value.status === "side_pool_already_retired" && isUuid(value.poolId) && isUuid(value.eventId);
}

// Mirrors the SQL rule, and is not a substitute for it. The workspace lists the
// newest election version per beneficiary whether or not it is still elected, so
// an empty list means no election was ever recorded, which is the same question
// retire_event_side_pool_v1 asks of the tables. A voided payout is absent from
// the workspace payload but still refused by the RPC, which is why the button
// disappearing is a convenience and the rejection is the guarantee.
export function canRetireSidePool(pool: SidePool, teamBeneficiaries: SidePoolTeamBeneficiary[]) {
  return pool.elections.length === 0
    && pool.payouts.length === 0
    && pool.policy === null
    && pool.collectedMinor === 0
    && pool.paidMinor === 0
    && !pool.finalized
    && !teamBeneficiaries.some((team) =>
      team.elections.some((election) => election.poolId === pool.poolId)
      || team.payouts.some((payout) => payout.poolId === pool.poolId));
}

export function retirementRejectionMessage(code: string, activity?: SidePoolActivity) {
  if (code === "side_pool_has_money") {
    const collected = activity ? ` This pool holds $${(activity.collectedMinor / 100).toFixed(2)}.` : "";
    return `Money has been received into this Side Pool, so it cannot be removed.${collected} Refund and void each election first, then remove the pool.`;
  }
  if (code === "side_pool_has_activity") {
    return "This Side Pool already has elections, payouts or a posted payout schedule recorded against it. Void that record first. Only a pool with no history can be removed.";
  }
  if (code === "not_director") return "Only a director or co-director can remove a Side Pool.";
  if (code === "pool_unavailable") return "That Side Pool is no longer available. Reload the page.";
  if (code === "idempotency_conflict") return "A different operation is already using this request id. Reload and try again.";
  // The RPC rejects a malformed payload too. The client guard should stop one
  // ever reaching it, so this arriving means the two disagree, and the director
  // needs to know that rather than being told to reload forever.
  if (code === "invalid_request") return "This removal request was not accepted by the server. Reload the page and try again, and report it if it happens twice.";
  return "The Side Pool could not be removed. Reload and try again.";
}
