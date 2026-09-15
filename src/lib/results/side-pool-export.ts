import type { SidePoolWorkspace } from "../api/side-pools.ts";

function cell(value: string | number | boolean | null) {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildSidePoolDirectorCsv(workspace: SidePoolWorkspace) {
  const rows: Array<Array<string | number | boolean | null>> = [[
    "Tournament", "Event", "Side Pool", "Category", "Entry Fee (cents)",
    "Participant", "Elected", "Due (cents)", "Received (cents)",
    "Remaining (cents)", "Payment Method", "Reference", "Placement",
    "Payout (cents)", "Voided", "Pool Collected (cents)",
    "Pool Paid (cents)", "Reconciled",
  ]];
  for (const event of workspace.events) for (const pool of event.pools) {
    const payouts = new Map(pool.payouts.map((payout) => [payout.participantId, payout]));
    if (!pool.elections.length) rows.push([workspace.tournamentName, event.name, pool.displayName, pool.categoryCode, pool.entryFeeMinor, "", false, 0, 0, 0, null, null, null, 0, false, pool.collectedMinor, pool.paidMinor, pool.finalized]);
    for (const election of pool.elections) {
      const payout = payouts.get(election.participantId);
      rows.push([workspace.tournamentName, event.name, pool.displayName, pool.categoryCode, pool.entryFeeMinor, election.displayName, election.elected, election.amountDueMinor, election.amountReceivedMinor, election.amountRemainingMinor, election.paymentMethod, election.paymentReference, payout?.placement ?? null, payout?.amountMinor ?? 0, payout?.voided ?? false, pool.collectedMinor, pool.paidMinor, pool.finalized]);
    }
  }
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
