import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import type { SidePoolWorkspace } from "../api/side-pools";

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;
export async function buildSidePoolReportPdf(workspace: SidePoolWorkspace, eventId?: string) {
  const document = await PDFDocument.create(); const regular = await document.embedFont(StandardFonts.Helvetica); const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const events = eventId ? workspace.events.filter((event) => event.eventId === eventId) : workspace.events;
  let page: PDFPage = document.addPage([612, 792]); let y = 750;
  const footer = () => page.drawText("Private director report · Side Pools are separate from Q Pools", { x: 36, y: 24, size: 8, font: regular, color: rgb(.35,.38,.42) });
  const line = (text: string, strong = false) => { if (y < 50) { footer(); page=document.addPage([612,792]); y=750; } page.drawText(text.slice(0, 110), { x: 36, y, size: strong ? 14 : 10, font: strong ? bold : regular, color: rgb(.08,.12,.18) }); y -= strong ? 22 : 15; };
  line(eventId ? "Side Pool Report by Event" : "Combined Tournament Side Pool Report", true); line(workspace.tournamentName, true);
  if (!events.length) line("No matching event found.");
  for (const event of events) { y -= 5; line(event.name, true); if (!event.pools.length) { line("No Side Pools configured."); continue; } for (const pool of event.pools) { line(`${pool.displayName} · entry ${money(pool.entryFeeMinor)} · collected ${money(pool.collectedMinor)} · paid ${money(pool.paidMinor)} · ${pool.finalized ? "finalized" : "open"}`); for (const election of pool.elections.filter((item) => item.elected)) line(`  ${election.displayName} · received ${money(election.amountReceivedMinor)} · remaining ${money(election.amountRemainingMinor)}`); for (const team of event.teamBeneficiaries ?? []) { const election=team.elections.find((item)=>item.poolId===pool.poolId); if(election?.elected) line(`  Team ${team.displayName} · received ${money(election.amountReceivedMinor)} · remaining ${money(election.amountRemainingMinor)}`); } for (const payout of pool.payouts.filter((item) => !item.voided)) line(`  Place ${payout.placement}: ${payout.displayName} · ${money(payout.amountMinor)}`); for(const team of event.teamBeneficiaries ?? []) for(const payout of team.payouts.filter((item)=>item.poolId===pool.poolId&&!item.voided)) line(`  Place ${payout.placement}: Team ${team.displayName} · ${money(payout.amountMinor)}`); } }
  footer(); return document.save();
}
