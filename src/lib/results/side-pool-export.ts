import type { SidePoolWorkspace } from "../api/side-pools.ts";
import { formatUsdInput } from "../money.ts";

function cell(value: string | number | boolean | null) {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildSidePoolDirectorCsv(workspace: SidePoolWorkspace) {
  const rows: Array<Array<string | number | boolean | null>> = [[
    "Tournament", "Event", "Side Pool", "Category", "Entry Fee (USD)",
    "Participant", "Elected", "Due (USD)", "Received (USD)",
    "Remaining (USD)", "Payment Method", "Reference", "Placement",
    "Payout (USD)", "Voided", "Pool Collected (USD)",
    "Pool Paid (USD)", "Reconciled",
  ]];
  for (const event of workspace.events) for (const pool of event.pools) {
    const payouts = new Map(pool.payouts.map((payout) => [payout.participantId, payout]));
    if (!pool.elections.length) rows.push([workspace.tournamentName, event.name, pool.displayName, pool.categoryCode, formatUsdInput(pool.entryFeeMinor), "", false, formatUsdInput(0), formatUsdInput(0), formatUsdInput(0), null, null, null, formatUsdInput(0), false, formatUsdInput(pool.collectedMinor), formatUsdInput(pool.paidMinor), pool.finalized]);
    for (const election of pool.elections) {
      const payout = payouts.get(election.participantId);
      rows.push([workspace.tournamentName, event.name, pool.displayName, pool.categoryCode, formatUsdInput(pool.entryFeeMinor), election.displayName, election.elected, formatUsdInput(election.amountDueMinor), formatUsdInput(election.amountReceivedMinor), formatUsdInput(election.amountRemainingMinor), election.paymentMethod, election.paymentReference, payout?.placement ?? null, formatUsdInput(payout?.amountMinor ?? 0), payout?.voided ?? false, formatUsdInput(pool.collectedMinor), formatUsdInput(pool.paidMinor), pool.finalized]);
    }
  }
  for (const event of workspace.events) for (const team of event.teamBeneficiaries ?? []) for (const pool of event.pools) {
    const election = team.elections.find((item) => item.poolId === pool.poolId);
    const payouts = team.payouts.filter((item) => item.poolId === pool.poolId && !item.voided);
    if (election?.elected && !payouts.length) rows.push([workspace.tournamentName, event.name, pool.displayName, pool.categoryCode, formatUsdInput(pool.entryFeeMinor), team.displayName, true, formatUsdInput(election.amountDueMinor), formatUsdInput(election.amountReceivedMinor), formatUsdInput(election.amountRemainingMinor), election.paymentMethod, election.paymentReference, null, formatUsdInput(0), false, formatUsdInput(pool.collectedMinor), formatUsdInput(pool.paidMinor), pool.finalized]);
    for (const payout of payouts) rows.push([workspace.tournamentName, event.name, pool.displayName, pool.categoryCode, formatUsdInput(pool.entryFeeMinor), team.displayName, election?.elected ?? false, formatUsdInput(election?.amountDueMinor ?? 0), formatUsdInput(election?.amountReceivedMinor ?? 0), formatUsdInput(election?.amountRemainingMinor ?? 0), election?.paymentMethod ?? null, election?.paymentReference ?? null, payout.placement, formatUsdInput(payout.amountMinor), false, formatUsdInput(pool.collectedMinor), formatUsdInput(pool.paidMinor), pool.finalized]);
  }
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
