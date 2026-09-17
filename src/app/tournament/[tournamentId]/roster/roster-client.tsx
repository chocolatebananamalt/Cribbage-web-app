"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PromotionCandidate, RosterEntry } from "../../../../lib/roster/workspace";
import { isAcceptedManualRosterEntry, isAcceptedRosterCsvImport, isAcceptedRosterPromotion, isRejectedManualRosterEntry, isRejectedRosterCsvImport, isRejectedRosterPromotion, type ManualRosterEntryRequest, type RosterCsvRow } from "../../../../lib/api/roster";
import { isAcceptedRosterStatus, isRejectedRosterStatus, type RosterStatusRequest } from "../../../../lib/api/roster-status";
import { parseRosterCsv } from "../../../../lib/roster/csv";
import { isAcceptedScorecardPreference, isRejectedScorecardPreference, type ScorecardPreferenceRequest } from "../../../../lib/api/scorecard-preference";
import { normalizeAccNumberInput } from "../../../../lib/acc-number.ts";

type PromotionEnvelope = { approvalDecisionId: string; idempotencyKey: string };

export default function RosterClient({ actorId, tournamentId, rosterEntries, withdrawnRosterEntries, promotionCandidates }: { actorId: string; tournamentId: string; rosterEntries: RosterEntry[]; withdrawnRosterEntries: RosterEntry[]; promotionCandidates: PromotionCandidate[] }) {
  const router = useRouter();
  void actorId;
  const promotionKey = `registration-operation:roster:${actorId}:${tournamentId}`;
  const manualKey = `manual-roster-operation:${actorId}:${tournamentId}`;
  const [firstName, setFirstName] = useState(""), [lastName, setLastName] = useState(""), [email, setEmail] = useState(""), [accNumber, setAccNumber] = useState("");
  const [scorecardType, setScorecardType] = useState<"digital" | "paper">("digital"), [csvRows, setCsvRows] = useState<RosterCsvRow[]>([]), [csvFileName, setCsvFileName] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null), [resolveTarget, setResolveTarget] = useState<RosterEntry | null>(null), [manualPending, setManualPending] = useState<ManualRosterEntryRequest | null>(null), [locked, setLocked] = useState<PromotionEnvelope | null>(null);
  void locked;
  const [reasonCode, setReasonCode] = useState<RosterStatusRequest["reasonCode"]>("duplicate_entry"), [note, setNote] = useState(""), [reinstateTarget, setReinstateTarget] = useState<RosterEntry | null>(null), [withdrawnExpanded, setWithdrawnExpanded] = useState(false);
  const send = async (path: string, body: object) => fetch(`/api/v1/tournaments/${tournamentId}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
  useEffect(() => { void (async () => {
    try { const raw = window.sessionStorage.getItem(manualKey); const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object" || (parsed as { kind?: unknown }).kind !== "manual-roster" || typeof (parsed as { idempotencyKey?: unknown }).idempotencyKey !== "string") return;
      const envelope = parsed as { kind: "manual-roster"; idempotencyKey: string };
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/roster-manual/reconciliation`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ idempotencyKey: envelope.idempotencyKey }) });
      if (response.ok) { window.sessionStorage.removeItem(manualKey); router.refresh(); } else setMessage("A prior manual entry has no server receipt. Check the roster before entering that player again.");
    } catch { setMessage("A prior manual entry has no server receipt. Check the roster before entering that player again."); }
  })(); }, [manualKey, router, tournamentId]);

  async function reconcilePromotion(envelope: PromotionEnvelope) {
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/roster-promotions/reconciliation`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(envelope) }); return response.ok ? "accepted" : "rejected"; } catch { return "unresolved"; }
  }
  // `reconcilePromotion` is intentionally local so its request scope remains this tournament.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void (async () => { try { const raw = window.sessionStorage.getItem(promotionKey); const envelope: unknown = raw ? JSON.parse(raw) : null; if (!envelope || typeof envelope !== "object" || typeof (envelope as PromotionEnvelope).approvalDecisionId !== "string" || typeof (envelope as PromotionEnvelope).idempotencyKey !== "string") return; const state = await reconcilePromotion(envelope as PromotionEnvelope); if (state !== "unresolved") { window.sessionStorage.removeItem(promotionKey); if (state === "accepted") router.refresh(); } else { setLocked(envelope as PromotionEnvelope); setMessage("A prior roster request has no server receipt. Refresh before retrying."); } } catch { /* Storage is optional until a new action starts. */ } })(); }, [promotionKey, router, tournamentId]);

  async function promote(envelope: PromotionEnvelope) {
    if (busy) return; const body = envelope; setBusy(true); setMessage(null);
    try { const response = await send("roster-promotions", body), payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedRosterPromotion(payload, body.approvalDecisionId)) { window.sessionStorage.removeItem(promotionKey); setLocked(null); router.refresh(); return; }
      if (response.status === 409 && isRejectedRosterPromotion(payload, body.approvalDecisionId)) { window.sessionStorage.removeItem(promotionKey);
        setLocked(null); const code = (payload as { code: string }).code; setMessage(code === "withdrawn_roster_entry" ? "This player was previously withdrawn. Reinstate the existing roster identity instead." : code === "duplicate_roster_entry" ? "That registration matches an active roster identity." : code === "potential_duplicate" ? "A possible name or email match needs director review before promotion." : "The tournament server did not accept that roster action."); return; }
      setMessage("The roster request is unresolved. Refresh the roster before retrying.");
    } catch { setMessage("The roster request is unresolved. Refresh the roster before retrying."); } finally { setBusy(false); }
  }

  async function submitManual(body: ManualRosterEntryRequest) {
    if (busy) return; setBusy(true); setManualPending(body); setMessage(null);
    try { window.sessionStorage.setItem(manualKey, JSON.stringify({ kind: "manual-roster", idempotencyKey: body.idempotencyKey })); } catch { setBusy(false); setManualPending(null); setMessage("This browser cannot safely retain a roster request for recovery. Enable session storage before continuing."); return; }
    try { const response = await send("roster-manual", body), payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedManualRosterEntry(payload)) { window.sessionStorage.removeItem(manualKey);
        setManualPending(null); setFirstName(""); setLastName(""); setEmail(""); setAccNumber(""); setMessage("Player added to the roster."); router.refresh(); return; }
      if (response.status === 409 && isRejectedManualRosterEntry(payload)) { window.sessionStorage.removeItem(manualKey);
        setManualPending(null); const code = (payload as { code: string }).code; setMessage(code === "withdrawn_roster_entry" ? "This player was previously withdrawn. Reinstate the existing roster identity instead." : code === "duplicate_roster_entry" ? "That player is already on this tournament roster." : code === "potential_duplicate" ? "A possible name or email match needs director review. Use the existing roster identity or resolve it first." : "The tournament server did not accept that manual roster entry."); return; }
      setMessage("The manual entry is unresolved. Refresh the roster before entering that player again.");
    } catch { setMessage("The manual entry is unresolved. Refresh the roster before entering that player again."); } finally { setBusy(false); }
  }
  function createManual(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!firstName.trim() || !lastName.trim()) return; void submitManual({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), accNumber: accNumber.trim(), scorecardType, idempotencyKey: crypto.randomUUID() }); }

  async function selectCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; setCsvRows([]); setCsvFileName(""); setMessage(null); if (!file) return;
    if (file.size > 500_000) { setMessage("That CSV is too large. Import no more than 500 players at a time."); event.target.value = ""; return; }
    try { const rows = parseRosterCsv(await file.text()); setCsvRows(rows); setCsvFileName(file.name); setMessage(`${rows.length} player${rows.length === 1 ? "" : "s"} validated and ready to import.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "That CSV could not be read."); event.target.value = ""; }
  }

  async function importCsv() {
    if (busy || !csvRows.length) return; const body = { rows: csvRows, idempotencyKey: crypto.randomUUID() }; setBusy(true); setMessage(null);
    try { const response = await send("roster-csv", body), payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedRosterCsvImport(payload)) { setCsvRows([]); setCsvFileName(""); setMessage(`${payload.importedCount} player${payload.importedCount === 1 ? "" : "s"} imported.`); router.refresh(); return; }
      if (response.status === 409 && isRejectedRosterCsvImport(payload)) { const code = (payload as { code: string }).code; setMessage(code === "withdrawn_roster_entry" ? "A CSV player was previously withdrawn. Reinstate the existing identity instead. No players were imported." : code === "duplicate_roster_entry" ? "At least one CSV entry is already on the roster. No players were imported." : code === "potential_duplicate" ? "A CSV row has a possible name or email match. No players were imported." : "The tournament server rejected this import. No players were imported."); return; }
      setMessage("The import is unresolved. Refresh before retrying the same file.");
    } catch { setMessage("The import is unresolved. Refresh before retrying the same file."); } finally { setBusy(false); }
  }

  async function updateScorecardPreference(entry: RosterEntry, nextType: "digital" | "paper") {
    if (busy || nextType === entry.scorecardType) return; const body: ScorecardPreferenceRequest = { rosterEntryId: entry.rosterEntryId, expectedVersion: entry.scorecardPreferenceVersion, scorecardType: nextType, reason: "", idempotencyKey: crypto.randomUUID() }; setBusy(true); setMessage(null);
    try { const response = await send("scorecard-preferences", body), payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedScorecardPreference(payload, body)) { setMessage("Scorecard preference updated."); router.refresh(); return; }
      if (response.status === 409 && isRejectedScorecardPreference(payload, entry.rosterEntryId)) { setMessage("The scorecard preference could not be changed. Refresh the roster before trying again."); return; }
      setMessage("The scorecard preference update is unresolved. Refresh before trying again.");
    } catch { setMessage("The scorecard preference update is unresolved. Refresh before trying again."); } finally { setBusy(false); }
  }

  async function setRosterStatus(entry: RosterEntry, action: "withdraw" | "reinstate") {
    if (busy) return; const body: RosterStatusRequest = { rosterEntryId: entry.rosterEntryId, action, reasonCode, note: note.trim(), idempotencyKey: crypto.randomUUID() }; setBusy(true); setMessage(null);
    try { const response = await send("roster-status", body), payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedRosterStatus(payload, body)) { setResolveTarget(null); setReinstateTarget(null); setNote(""); setMessage(action === "withdraw" ? "The player was removed from active roster operations. History is preserved." : "The original roster identity was reinstated."); router.refresh(); return; }
      if (response.status === 409 && isRejectedRosterStatus(payload, entry.rosterEntryId)) { const code = (payload as { code: string }).code; setMessage(code === "downstream_activity_requires_event_workflow" ? "This player has payments, check-in, seating, enrollment, or score activity. Use the applicable financial or event workflow instead." : "The roster status could not be changed. Refresh before trying again."); return; }
      setMessage("The roster status request is unresolved. Refresh before retrying.");
    } catch { setMessage("The roster status request is unresolved. Refresh before retrying."); } finally { setBusy(false); }
  }

  return <section className="policy-settings">
    <section className="manual-roster-panel" aria-labelledby="csv-roster-title"><h2 id="csv-roster-title">Import Player List</h2><p>Use separate <strong>First Name</strong> and <strong>Last Name</strong> columns. <strong>Email</strong>, <strong>ACC #</strong>, and <strong>Scorecard Type</strong> are optional. ACC # must be a two-letter state abbreviation followed immediately by the number, such as <strong>HI296</strong>, or <strong>HI296Y</strong> for a youth player. Scorecard Type accepts Digital or Paper and defaults to Digital. The full file is checked before anyone is added.</p><div className="roster-csv-controls"><label>Player CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => void selectCsv(event)} /></label><button className="primary" type="button" disabled={busy || !csvRows.length} onClick={() => void importCsv()}>Import {csvRows.length || ""} Player{csvRows.length === 1 ? "" : "s"}</button></div>{csvFileName ? <p><strong>{csvFileName}</strong> · {csvRows.length} validated row{csvRows.length === 1 ? "" : "s"}</p> : null}</section>
    <section className="manual-roster-panel" aria-labelledby="manual-roster-title"><h2 id="manual-roster-title">Add Player Manually</h2><p>Use this fallback for a phone, paper list, or spreadsheet entry. Email and ACC number are optional.</p><form className="manual-roster-form" onSubmit={createManual}><label>First name<input required maxLength={80} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>Last name<input required maxLength={80} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label><label>Email (optional)<input maxLength={320} inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>ACC # (optional)<input maxLength={64} autoCapitalize="characters" value={accNumber} onChange={(event) => setAccNumber(normalizeAccNumberInput(event.target.value))} /><span className="field-help">Use HI296, or HI296Y for a youth player.</span></label><label>Scorecard Type<select value={scorecardType} onChange={(event) => setScorecardType(event.target.value as "digital" | "paper")}><option value="digital">Digital</option><option value="paper">Paper</option></select></label><button className="primary" type="submit" disabled={busy || !firstName.trim() || !lastName.trim()}>Add Player</button></form>{manualPending ? <button className="primary" type="button" disabled={busy} onClick={() => void submitManual(manualPending)}>Retry manual entry</button> : null}</section>
    <h2>Approved registration candidates</h2><p>Payment preference is unverified and is not payment. Promoting a candidate creates only a private roster identity snapshot.</p>{promotionCandidates.length ? <ul>{promotionCandidates.map((candidate) => <li key={candidate.approvalDecisionId}><strong>{candidate.displayName}</strong> · {candidate.email}{candidate.accNumber ? ` · ${candidate.accNumber}` : ""} · {candidate.scorecardType} scorecard · planned {candidate.intendedPaymentMethod}<button className="primary" type="button" disabled={busy} onClick={() => { const envelope = { approvalDecisionId: candidate.approvalDecisionId, idempotencyKey: crypto.randomUUID() }; try { window.sessionStorage.setItem(promotionKey, JSON.stringify(envelope)); } catch { setMessage("Enable session storage before continuing."); return; } setLocked(envelope); void promote(envelope); }}>Create approved roster identity</button></li>)}</ul> : <p>No reviewed registrations are waiting for roster creation.</p>}
    <h2>Roster identities</h2>{rosterEntries.length ? <ul>{rosterEntries.map((entry) => <li key={entry.rosterEntryId}><strong>{entry.displayName}</strong>{entry.email ? ` · ${entry.email}` : ""}{entry.accNumber ? ` · ${entry.accNumber}` : ""} <span className="status-pill">{entry.source === "director_manual" ? "Manual" : entry.source === "director_csv" ? "CSV" : "Registration"}</span><label>Scorecard Type<select aria-label={`Scorecard Type for ${entry.displayName}`} value={entry.scorecardType} disabled={busy} onChange={(event) => void updateScorecardPreference(entry, event.target.value as "digital" | "paper")}><option value="digital">Digital</option><option value="paper">Paper</option></select></label><button type="button" disabled={busy} onClick={() => { setResolveTarget(entry); setReasonCode("duplicate_entry"); setNote(""); }}>Remove from active roster</button></li>)}</ul> : <p>No active roster identities have been created.</p>}
    {resolveTarget ? <section className="manual-roster-panel" aria-labelledby="resolve-roster-entry"><h2 id="resolve-roster-entry">Remove {resolveTarget.displayName} from active roster</h2><p><strong>You are removing the existing active roster record—not resolving a pending registration.</strong></p><p>This preserves the registration, payments, seating, and audit history. It removes only the active roster identity from future enrollment, seating, and scheduling.</p><label>Reason<select value={reasonCode} onChange={(event) => setReasonCode(event.target.value as RosterStatusRequest["reasonCode"])}><option value="duplicate_entry">Duplicate entry</option><option value="player_withdrew">Player withdrew</option><option value="unable_to_attend">Unable to attend</option><option value="administrative_correction">Administrative correction</option><option value="other">Other</option></select></label><label>Note {reasonCode === "other" ? "(required)" : "(optional)"}<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="primary" type="button" disabled={busy || (reasonCode === "other" && !note.trim())} onClick={() => void setRosterStatus(resolveTarget, "withdraw")}>Remove from active roster</button><button type="button" disabled={busy} onClick={() => setResolveTarget(null)}>Cancel</button></section> : null}
    {withdrawnRosterEntries.length ? <details onToggle={(event) => setWithdrawnExpanded((event.currentTarget as HTMLDetailsElement).open)}><summary>{withdrawnExpanded ? "▾" : "▸"} Withdrawn / resolved records ({withdrawnRosterEntries.length}) — click to {withdrawnExpanded ? "hide" : "view"} list</summary><ul>{withdrawnRosterEntries.map((entry) => <li key={entry.rosterEntryId}><strong>{entry.displayName}</strong> · {entry.reasonCode?.replaceAll("_", " ") ?? "resolved"}{entry.note ? ` · ${entry.note}` : ""}<button type="button" disabled={busy} onClick={() => { setReinstateTarget(entry); setReasonCode("administrative_correction"); setNote(""); }}>Reinstate</button></li>)}</ul></details> : null}
    {reinstateTarget ? <section className="manual-roster-panel" aria-labelledby="reinstate-roster-entry"><h2 id="reinstate-roster-entry">Reinstate {reinstateTarget.displayName}</h2><p>This restores the original roster identity. It does not create a second player record or alter history.</p><button className="primary" type="button" disabled={busy} onClick={() => void setRosterStatus(reinstateTarget, "reinstate")}>Yes, reinstate original identity</button><button type="button" disabled={busy} onClick={() => setReinstateTarget(null)}>Cancel</button></section> : null}
    {message ? <p className="error-text" role="status">{message}</p> : null}
  </section>;
}
