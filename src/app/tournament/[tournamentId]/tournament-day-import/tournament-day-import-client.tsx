"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAcceptedTournamentDayImport, isRejectedTournamentDayImport, type TournamentDayImportRow, type TournamentDayImportWorkspace } from "../../../../lib/api/tournament-day-import";
import { parseTournamentDayCsv, tournamentDayCsvTemplateHeaders } from "../../../../lib/roster/tournament-day-csv";

const dollars = (minor: number) => `$${(minor / 100).toFixed(2)}`;

function totalRow(row: TournamentDayImportRow) {
  return row.eventEnrollments.reduce((sum, item) => sum + item.amountMinor, 0)
    + row.qPoolPayments.reduce((sum, item) => sum + item.amountMinor, 0)
    + row.sidePoolElections.reduce((sum, item) => sum + item.amountMinor, 0);
}

export default function TournamentDayImportClient({ tournamentId, workspace }: { tournamentId: string; workspace: TournamentDayImportWorkspace }) {
  const router = useRouter();
  const [rows, setRows] = useState<TournamentDayImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const template = useMemo(() => tournamentDayCsvTemplateHeaders(workspace).join(","), [workspace]);
  const totals = useMemo(() => ({
    paymentMinor: rows.reduce((sum, row) => sum + totalRow(row), 0),
    eventEnrollments: rows.reduce((sum, row) => sum + row.eventEnrollments.length, 0),
    sidePoolElections: rows.reduce((sum, row) => sum + row.sidePoolElections.length, 0),
    qPoolMinor: rows.reduce((sum, row) => sum + row.qPoolPayments.reduce((rowSum, item) => rowSum + item.amountMinor, 0), 0),
  }), [rows]);

  async function selectCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRows([]);
    setFileName("");
    setMessage(null);
    if (!file) return;
    if (file.size > 750_000) { setMessage("That CSV is too large. Import no more than 500 players at a time."); event.target.value = ""; return; }
    try {
      const parsed = parseTournamentDayCsv(await file.text(), workspace);
      setRows(parsed);
      setFileName(file.name);
      setMessage(`${parsed.length} player row${parsed.length === 1 ? "" : "s"} validated. Review the summary, then import.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That CSV could not be read.");
      event.target.value = "";
    }
  }

  async function importCsv() {
    if (busy || !rows.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const body = JSON.stringify({ rows, idempotencyKey: crypto.randomUUID() });
      // The route reads this through readLargeJson, which stops at 524288 bytes
      // and hands the type guard null, so an oversized import comes back as a 400
      // saying the request shape is invalid. The shape is fine, the file is just
      // too big, and the director would have read a shape error and had nothing
      // to act on. Each row carries a UUID per event, Q Pool and Side Pool column,
      // so a tournament with many columns reaches that ceiling well below the
      // 500-player row limit that the CSV size check upstream is measuring.
      if (new TextEncoder().encode(body).length > 524_288) {
        setMessage("This import is too large to send in one request. Split the spreadsheet into smaller files and import each one.");
        return;
      }
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/tournament-day-import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedTournamentDayImport(payload)) {
        setRows([]);
        setFileName("");
        setMessage(`Imported ${payload.importedRows} rows: ${payload.rosterCreatedCount} new roster identities, ${payload.rosterMatchedCount} existing roster matches, ${payload.eventEnrollmentCount} new event enrollments, ${payload.paymentReceiptCount} payment receipt${payload.paymentReceiptCount === 1 ? "" : "s"}, and ${payload.sidePoolElectionCount} Side Pool election${payload.sidePoolElectionCount === 1 ? "" : "s"}.`);
        router.refresh();
        return;
      }
      if (response.status === 409 && isRejectedTournamentDayImport(payload)) {
        const code = payload.code;
        setMessage(code === "registration_closed" ? "Tournament registration is not open, so this fallback import is blocked."
          : code === "initial_seating_already_published" ? "Initial seating has already been published. Do not import a new desk roster after seating."
          : code === "payment_conflict" ? "At least one matched roster identity already has different payment evidence. Resolve that player in Payments before importing this file."
          : code === "side_pool_election_conflict" ? "At least one Side Pool election already exists with different collection evidence. Resolve it in Event Side Pools before importing this file."
          : code === "event_unavailable" ? "The file references an event that is not currently active and finalized."
          : code === "withdrawn_roster_entry" ? "The file matches a withdrawn roster identity. Reinstate that player before importing."
          : code === "idempotency_conflict" ? "The import request conflicted with a prior retry. Refresh and retry once."
          : "The tournament server rejected this import. No partial import was applied.");
        return;
      }
      setMessage("The import is unresolved. Refresh the page and check the roster/payments before retrying.");
    } catch {
      setMessage("The import is unresolved. Refresh the page and check the roster/payments before retrying.");
    } finally {
      setBusy(false);
    }
  }

  function downloadBlankTemplate() {
    const blankRows = Array.from({ length: 100 }, () => tournamentDayCsvTemplateHeaders(workspace).map(() => "").join(","));
    const csv = `${template}\n${blankRows.join("\n")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${workspace.tournamentName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tournament"}-day-import-template.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="policy-settings">
      <section className="manual-roster-panel" aria-labelledby="csv-template-title">
        <h2 id="csv-template-title">CSV columns for this tournament</h2>
        <p>Copy this header row into your spreadsheet. Amount columns accept dollars such as <strong>50</strong> or <strong>50.00</strong>. Blank or zero means the player did not enter that event or pool.</p>
        <textarea readOnly rows={4} value={template} aria-label="Tournament day CSV header template" />
        <button className="secondary" type="button" onClick={downloadBlankTemplate}>Download blank CSV template</button>
        <p className="muted">The download includes 100 starter rows. Add more rows as needed; each upload may contain up to 500 players.</p>
        <ul>
          <li><strong>ACC # is required</strong> and may be adult or youth format, such as HI296 or HI296Y.</li>
          <li><strong>Scorecard Type</strong> must be Digital or Paper.</li>
          <li><strong>Payment Status</strong> accepts Paid or Unpaid. Unpaid players are enrolled but sent to the desk at event QR check-in.</li>
          <li><strong>Payment Method</strong> accepts Cash, Check, Digital, Venmo, Zelle, or Other. Side Pool collection currently imports only Cash or Check.</li>
          <li>Q Pool dollars are included in payment/audit evidence. Side Pool columns create operational Side Pool elections.</li>
          <li>CSV files cannot contain dropdown fields. Use the exact listed words for Scorecard Type, Payment Status, and Payment Method.</li>
        </ul>
      </section>
      <section className="manual-roster-panel" aria-labelledby="csv-upload-title">
        <h2 id="csv-upload-title">Import desk spreadsheet</h2>
        <div className="roster-csv-controls">
          <label>Registered player CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => void selectCsv(event)} /></label>
          <button className="primary" type="button" disabled={busy || !rows.length} onClick={() => void importCsv()}>Import {rows.length || ""} Row{rows.length === 1 ? "" : "s"}</button>
        </div>
        {fileName ? <p><strong>{fileName}</strong> · {rows.length} validated row{rows.length === 1 ? "" : "s"}</p> : null}
        {rows.length ? <section aria-labelledby="csv-preview-title"><h3 id="csv-preview-title">Import preview</h3><ul><li>{totals.eventEnrollments} event enrollment record{totals.eventEnrollments === 1 ? "" : "s"}</li><li>{dollars(totals.paymentMinor)} total payment evidence</li><li>{dollars(totals.qPoolMinor)} Q Pool payment evidence included in the audit/payment summary</li><li>{totals.sidePoolElections} operational Side Pool election{totals.sidePoolElections === 1 ? "" : "s"}</li></ul></section> : null}
      </section>
      <section className="manual-roster-panel" aria-labelledby="active-events-title">
        <h2 id="active-events-title">Active events available to this import</h2>
        <ul>{workspace.events.map((event) => <li key={event.eventId}><strong>{event.name}</strong> · {event.eventType} · {event.format} · {event.scoringMethod}{event.qPoolSlots.length ? ` · Q Pools ${event.qPoolSlots.join(", ")}` : ""}{event.sidePools.length ? ` · Side Pools: ${event.sidePools.map((pool) => `${pool.displayName} ${dollars(pool.entryFeeMinor)}`).join("; ")}` : ""}</li>)}</ul>
      </section>
      {message ? <p className="error-text" role="status">{message}</p> : null}
    </section>
  );
}
