"use client";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PromotionCandidate, RosterEntry } from "../../../../lib/roster/workspace";
import { isAcceptedManualRosterEntry, isAcceptedRosterCsvImport, isAcceptedRosterPromotion, isRejectedManualRosterEntry, isRejectedRosterCsvImport, isRejectedRosterPromotion, isUuid, type ManualRosterEntryRequest, type RosterCsvRow } from "../../../../lib/api/roster";
import { parseRosterCsv } from "../../../../lib/roster/csv";
import { isAcceptedScorecardPreference, isRejectedScorecardPreference, type ScorecardPreferenceRequest } from "../../../../lib/api/scorecard-preference";

type Envelope = { kind: "roster-promotion"; approvalDecisionId: string; idempotencyKey: string };
type ManualRecovery = { kind: "manual-roster"; idempotencyKey: string };
type ManualPending = ManualRosterEntryRequest & { kind: "manual-roster" };
type CsvPending = { kind: "roster-csv"; idempotencyKey: string };
const valid = (value: unknown): value is Envelope => !!value && typeof value === "object" && (value as Envelope).kind === "roster-promotion" && isUuid((value as Envelope).approvalDecisionId) && isUuid((value as Envelope).idempotencyKey);
const validManualRecovery = (value: unknown): value is ManualRecovery => !!value && typeof value === "object" && (value as ManualRecovery).kind === "manual-roster" && isUuid((value as ManualRecovery).idempotencyKey);
function read(key: string) { try { const raw = window.sessionStorage.getItem(key); const parsed: unknown = raw ? JSON.parse(raw) : null; return valid(parsed) ? parsed : null; } catch { return null; } }
function readManual(key: string) { try { const raw = window.sessionStorage.getItem(key); const parsed: unknown = raw ? JSON.parse(raw) : null; return validManualRecovery(parsed) ? parsed : null; } catch { return null; } }
function validCsvPending(value: unknown): value is CsvPending { return !!value && typeof value === "object" && (value as CsvPending).kind === "roster-csv" && isUuid((value as CsvPending).idempotencyKey); }
function readCsvPending(key: string) { try { const raw = window.sessionStorage.getItem(key); const parsed: unknown = raw ? JSON.parse(raw) : null; return validCsvPending(parsed) ? parsed : null; } catch { return null; } }
function write(key: string, value: Envelope | ManualRecovery | CsvPending) { try { window.sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function clear(key: string) { try { window.sessionStorage.removeItem(key); } catch { /* Server receipt remains authoritative. */ } }

export default function RosterClient({ actorId, tournamentId, rosterEntries, promotionCandidates }: { actorId: string; tournamentId: string; rosterEntries: RosterEntry[]; promotionCandidates: PromotionCandidate[] }) {
  const router = useRouter(), key = `registration-operation:roster:${actorId}:${tournamentId}`, manualKey = `manual-roster-operation:${actorId}:${tournamentId}`, csvKey = `roster-csv-operation:${actorId}:${tournamentId}`;
  const [locked, setLocked] = useState<Envelope | null>(null), [manualPending, setManualPending] = useState<ManualPending | null>(null), [csvPending, setCsvPending] = useState<CsvPending | null>(null);
  const [firstName, setFirstName] = useState(""), [lastName, setLastName] = useState(""), [email, setEmail] = useState(""), [accNumber, setAccNumber] = useState("");
  const [scorecardType, setScorecardType] = useState<"digital" | "paper">("digital");
  const [csvRows, setCsvRows] = useState<RosterCsvRow[]>([]), [csvFileName, setCsvFileName] = useState("");
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  const reconcile = useCallback(async (envelope: Envelope) => {
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/roster-promotions/reconciliation`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(envelope) }); const payload: unknown = response.ok ? await response.json().catch(() => null) : null; const result = payload && typeof payload === "object" ? (payload as Record<string, unknown>).result : null; return response.ok && isAcceptedRosterPromotion(result, envelope.approvalDecisionId) ? "accepted" : response.ok && isRejectedRosterPromotion(result, envelope.approvalDecisionId) ? "rejected" : "unresolved"; } catch { return "unresolved"; }
  }, [tournamentId]);
  const reconcileManual = useCallback(async (envelope: ManualRecovery) => {
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/roster-manual/reconciliation`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ idempotencyKey: envelope.idempotencyKey }) }); const payload: unknown = response.ok ? await response.json().catch(() => null) : null; const result = payload && typeof payload === "object" ? (payload as Record<string, unknown>).result : null; return response.ok && isAcceptedManualRosterEntry(result) ? "accepted" : response.ok && isRejectedManualRosterEntry(result) ? "rejected" : "unresolved"; } catch { return "unresolved"; }
  }, [tournamentId]);
  const reconcileCsv = useCallback(async (envelope: CsvPending) => {
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/roster-csv/reconciliation`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ idempotencyKey: envelope.idempotencyKey }) }); const payload: unknown = response.ok ? await response.json().catch(() => null) : null; const result = payload && typeof payload === "object" ? (payload as Record<string, unknown>).result : null; return response.ok && isAcceptedRosterCsvImport(result) ? "accepted" : response.ok && isRejectedRosterCsvImport(result) ? "rejected" : "unresolved"; } catch { return "unresolved"; }
  }, [tournamentId]);
  useEffect(() => { void (async () => {
    const saved = read(key);
    if (saved) { const state = await reconcile(saved); if (state === "accepted") { clear(key); setReady(true); router.refresh(); return; } if (state === "rejected") { clear(key); setMessage("The server did not create that roster entry. The current list is shown."); } else { setLocked(saved); setMessage("A prior roster request needs a safe retry. Its target is locked until resolved."); } }
    const savedManual = readManual(manualKey);
    if (savedManual) { const state = await reconcileManual(savedManual); clear(manualKey); if (state === "accepted") { setReady(true); router.refresh(); return; } if (state === "unresolved") setMessage("A previous manual entry has no server receipt. Check the roster before entering that player again."); }
    const savedCsv = readCsvPending(csvKey);
    if (savedCsv) { const state = await reconcileCsv(savedCsv); if (state === "accepted") { clear(csvKey); setReady(true); router.refresh(); return; } if (state === "rejected") clear(csvKey); else { setCsvPending(savedCsv); setMessage("A previous CSV import has no server receipt. Reselect the same CSV to retry that exact request."); } }
    setReady(true);
  })(); }, [csvKey, key, manualKey, router, reconcile, reconcileCsv, reconcileManual]);
  async function promote(envelope: Envelope) {
    if (busy) return; setBusy(true); setLocked(envelope); setMessage(null);
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/roster-promotions`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(envelope) }); const payload: unknown = await response.json().catch(() => null); if (response.ok && isAcceptedRosterPromotion(payload, envelope.approvalDecisionId)) { clear(key); setLocked(null); router.refresh(); return; } if (response.status === 409 && isRejectedRosterPromotion(payload, envelope.approvalDecisionId)) { clear(key); setLocked(null); setMessage("The tournament server did not accept that roster action."); return; } setMessage("The roster request is unresolved. Retry uses the same protected request."); } catch { setMessage("The roster request is unresolved. Retry uses the same protected request."); } finally { setBusy(false); }
  }
  async function createManual(request: ManualPending) {
    if (busy) return; setBusy(true); setManualPending(request); setMessage(null);
    try { const { kind: _kind, ...body } = request; void _kind; const response = await fetch(`/api/v1/tournaments/${tournamentId}/roster-manual`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) }); const payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedManualRosterEntry(payload)) { clear(manualKey); setManualPending(null); setFirstName(""); setLastName(""); setEmail(""); setAccNumber(""); setMessage("Player added to the roster."); router.refresh(); return; }
      if (response.status === 409 && isRejectedManualRosterEntry(payload)) { clear(manualKey); setManualPending(null); const code = (payload as { code: string }).code; setMessage(code === "duplicate_roster_entry" ? "That player is already on this tournament roster." : code === "initial_seating_already_published" ? "The roster is locked because initial seating has already been published." : "The tournament server did not accept that manual roster entry."); return; }
      setMessage("The manual entry is unresolved. Retry uses the same protected request.");
    } catch { setMessage("The manual entry is unresolved. Retry uses the same protected request."); } finally { setBusy(false); }
  }
  function start(decisionId: string) { if (!ready || locked || busy) return; const envelope = { kind: "roster-promotion" as const, approvalDecisionId: decisionId, idempotencyKey: crypto.randomUUID() }; if (!write(key, envelope)) { setMessage("This browser cannot safely retain a roster request for recovery. Enable session storage before continuing."); return; } setLocked(envelope); void promote(envelope); }
  function submitManual(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!ready || locked || busy || manualPending || !firstName.trim() || !lastName.trim()) return; const request: ManualPending = { kind: "manual-roster", firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), accNumber: accNumber.trim(), scorecardType, idempotencyKey: crypto.randomUUID() }; if (!write(manualKey, { kind: request.kind, idempotencyKey: request.idempotencyKey })) { setMessage("This browser cannot safely retain a roster request for recovery. Enable session storage before continuing."); return; } void createManual(request); }
  async function updateScorecardPreference(entry: RosterEntry, nextType: "digital" | "paper") {
    if (busy || nextType === entry.scorecardType) return;
    const request: ScorecardPreferenceRequest = { rosterEntryId: entry.rosterEntryId, expectedVersion: entry.scorecardPreferenceVersion, scorecardType: nextType, reason: "", idempotencyKey: crypto.randomUUID() };
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/scorecard-preferences`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(request) });
      const payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedScorecardPreference(payload, request)) { setMessage("Scorecard preference updated."); router.refresh(); return; }
      if (response.status === 409 && isRejectedScorecardPreference(payload, entry.rosterEntryId)) { setMessage("The scorecard preference could not be changed. Refresh the roster before trying again."); return; }
      setMessage("The scorecard preference update is unresolved. Refresh before trying again.");
    } catch { setMessage("The scorecard preference update is unresolved. Refresh before trying again."); }
    finally { setBusy(false); }
  }
  async function selectCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; setCsvRows([]); setCsvFileName(""); setMessage(null);
    if (!file) return;
    if (file.size > 500_000) { setMessage("That CSV is too large. Import no more than 500 players at a time."); event.target.value = ""; return; }
    try { const rows = parseRosterCsv(await file.text()); setCsvRows(rows); setCsvFileName(file.name); setMessage(`${rows.length} player${rows.length === 1 ? "" : "s"} validated and ready to import.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "That CSV could not be read."); event.target.value = ""; }
  }
  async function importCsv() {
    if (!ready || busy || locked || manualPending || !csvRows.length) return;
    const pending: CsvPending = csvPending ?? { kind: "roster-csv", idempotencyKey: crypto.randomUUID() };
    if (!csvPending && !write(csvKey, pending)) { setMessage("This browser cannot safely retain the import request for recovery. Enable session storage before continuing."); return; }
    setCsvPending(pending);
    setBusy(true); setMessage(null);
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/roster-csv`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ rows: csvRows, idempotencyKey: pending.idempotencyKey }) }); const payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedRosterCsvImport(payload)) { clear(csvKey); setCsvPending(null); setCsvRows([]); setCsvFileName(""); setMessage(`${payload.importedCount} player${payload.importedCount === 1 ? "" : "s"} imported.`); router.refresh(); return; }
      if (response.status === 409 && isRejectedRosterCsvImport(payload)) { clear(csvKey); setCsvPending(null); const code = (payload as { code: string }).code; setMessage(code === "duplicate_in_batch" ? "The CSV contains a duplicate player." : code === "duplicate_roster_entry" ? "At least one CSV entry is already on the roster. No players were imported." : code === "registration_closed" || code === "initial_seating_already_published" ? "The roster is locked. No players were imported." : "The tournament server rejected this import. No players were imported."); return; }
      setMessage("The import is unresolved. Keep this page open and retry with the same file.");
    } catch { setMessage("The import is unresolved. Keep this page open and retry with the same file."); } finally { setBusy(false); }
  }
  return <section className="policy-settings">
    <section className="manual-roster-panel" aria-labelledby="csv-roster-title"><h2 id="csv-roster-title">Import Player List</h2><p>Use separate <strong>First Name</strong> and <strong>Last Name</strong> columns. <strong>Email</strong>, <strong>ACC #</strong>, and <strong>Scorecard Type</strong> are optional. ACC # must be a two-letter state abbreviation followed immediately by the number, such as <strong>HI296</strong>. Scorecard Type accepts Digital or Paper and defaults to Digital. The full file is checked before anyone is added.</p><div className="roster-csv-controls"><label>Player CSV<input type="file" accept=".csv,text/csv" disabled={!ready || busy || !!locked || !!manualPending} onChange={(event) => void selectCsv(event)} /></label><button className="primary" type="button" disabled={!ready || busy || !!locked || !!manualPending || !csvRows.length} onClick={() => void importCsv()}>Import {csvRows.length || ""} Player{csvRows.length === 1 ? "" : "s"}</button></div>{csvFileName ? <p><strong>{csvFileName}</strong> · {csvRows.length} validated row{csvRows.length === 1 ? "" : "s"}</p> : null}</section>
    <section className="manual-roster-panel" aria-labelledby="manual-roster-title"><h2 id="manual-roster-title">Add Player Manually</h2><p>Use this fallback for a phone, paper list, or spreadsheet entry. Email and ACC number are optional.</p><form className="manual-roster-form" onSubmit={submitManual}><label>First name<input required maxLength={80} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>Last name<input required maxLength={80} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label><label>Email (optional)<input maxLength={320} inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>ACC # (optional)<input maxLength={64} autoCapitalize="characters" value={accNumber} onChange={(event) => setAccNumber(event.target.value)} /></label><label>Scorecard Type<select value={scorecardType} onChange={(event) => setScorecardType(event.target.value as "digital" | "paper")}><option value="digital">Digital</option><option value="paper">Paper</option></select></label><button className="primary" type="submit" disabled={!ready || !!locked || busy || !!manualPending || !firstName.trim() || !lastName.trim()}>Add Player</button></form>{manualPending ? <button className="primary" type="button" disabled={busy} onClick={() => void createManual(manualPending)}>Retry manual entry</button> : null}</section>
    <h2>Approved registration candidates</h2><p>Payment preference is unverified and is not payment. Promoting a candidate creates only a private roster identity snapshot.</p>{promotionCandidates.length ? <ul>{promotionCandidates.map((candidate) => <li key={candidate.approvalDecisionId}><strong>{candidate.displayName}</strong> · {candidate.email}{candidate.accNumber ? ` · ${candidate.accNumber}` : ""} · {candidate.scorecardType} scorecard · planned {candidate.intendedPaymentMethod}<button className="primary" type="button" disabled={!ready || !!locked || busy} onClick={() => start(candidate.approvalDecisionId)}>{locked?.approvalDecisionId === candidate.approvalDecisionId ? "Retry roster entry" : "Create roster identity"}</button></li>)}</ul> : <p>No reviewed registrations are waiting for roster creation.</p>}
    <h2>Roster identities</h2>{rosterEntries.length ? <ul>{rosterEntries.map((entry) => <li key={entry.rosterEntryId}><strong>{entry.displayName}</strong>{entry.email ? ` · ${entry.email}` : ""}{entry.accNumber ? ` · ${entry.accNumber}` : ""} <span className="status-pill">{entry.source === "director_manual" ? "Manual" : entry.source === "director_csv" ? "CSV" : "Registration"}</span><label>Scorecard Type<select aria-label={`Scorecard Type for ${entry.displayName}`} value={entry.scorecardType} disabled={busy} onChange={(event) => void updateScorecardPreference(entry, event.target.value as "digital" | "paper")}><option value="digital">Digital</option><option value="paper">Paper</option></select></label></li>)}</ul> : <p>No roster identities have been created.</p>}{locked && <button className="primary" type="button" disabled={busy} onClick={() => void promote(locked)}>Retry roster request</button>}{message && <p className="error-text" role="status">{message}</p>}
  </section>;
}
