"use client";
import { setAppRecoveryItem, transitionAppRecoveryItem, trackAppRecoveryWrite, assertRecoveryWriteAllowed } from "../../../../lib/recovery-write-coordinator";

import { type ChangeEvent, type FormEvent, useEffect, useLayoutEffect, useMemo, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { rosterIntakeMessage, type RosterIntakeState } from "../../../../lib/director-checklist";
import { useRouter } from "next/navigation";
import type { PromotionCandidate, RosterEntry } from "../../../../lib/roster/workspace";
import { isAcceptedManualRosterEntry, isAcceptedRosterCsvImport, isAcceptedRosterPromotion, isRejectedManualRosterEntry, isRejectedRosterCsvImport, isRejectedRosterPromotion, rosterPromotionReconciliation, type ManualRosterEntryRequest, type RosterCsvRow } from "../../../../lib/api/roster";
import { isAcceptedRosterStatus, isRejectedRosterStatus, type RosterStatusRequest } from "../../../../lib/api/roster-status";
import { parseRosterCsv } from "../../../../lib/roster/csv";
import { isAcceptedScorecardPreference, isRejectedScorecardPreference, type ScorecardPreferenceRequest } from "../../../../lib/api/scorecard-preference";
import { normalizeAccNumberInput } from "../../../../lib/acc-number.ts";

import {createClient} from '../../../../lib/supabase/client';
import {requireVerifiedIdentity} from '../../../../lib/api/verified-subject';
import {isUuid} from '../../../../lib/api/validation';
import {manualRetainedOperationV22,acceptedManualRecoveryV22} from '../../../../lib/roster/manual-recovery-v22';

type PromotionEnvelope = { approvalDecisionId: string; idempotencyKey: string };

export default function RosterClient({ actorId, tournamentId, rosterEntries, withdrawnRosterEntries, promotionCandidates, intakeState }: { intakeState: RosterIntakeState; actorId: string; tournamentId: string; rosterEntries: RosterEntry[]; withdrawnRosterEntries: RosterEntry[]; promotionCandidates: PromotionCandidate[] }) {
  const router = useRouter();
  void actorId;
  const promotionKey = `registration-operation:roster:${actorId}:${tournamentId}`;
  const manualKey = `manual-roster-operation:${actorId}:${tournamentId}`;
  const [firstName, setFirstName] = useState(""), [lastName, setLastName] = useState(""), [email, setEmail] = useState(""), [accNumber, setAccNumber] = useState("");
  const [scorecardType, setScorecardType] = useState<"digital" | "paper">("digital"), [csvRows, setCsvRows] = useState<RosterCsvRow[]>([]), [csvFileName, setCsvFileName] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null), [resolveTarget, setResolveTarget] = useState<RosterEntry | null>(null), [manualPending, setManualPending] = useState<ManualRosterEntryRequest | null>(null), [locked, setLocked] = useState<PromotionEnvelope | null>(null);
  const promotionFlight = useRef(false);
  const [promotionReady, setPromotionReady] = useState(false);
  const [reasonCode, setReasonCode] = useState<RosterStatusRequest["reasonCode"]>("duplicate_entry"), [note, setNote] = useState(""), [reinstateTarget, setReinstateTarget] = useState<RosterEntry | null>(null), [withdrawnExpanded, setWithdrawnExpanded] = useState(false);
  const send = async (path: string, body: object) => fetch(`/api/v1/tournaments/${tournamentId}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
  const manualScope=useMemo(()=>({actorId,tournamentId}),[actorId,tournamentId]);
  const manualCurrent=useRef<object|null>(null),manualEpoch=useRef(0),manualFlight=useRef(false);
  const invalidateManual=useCallback(()=>{manualEpoch.current++;},[]);
  const [manualRecord,setManualRecord]=useState<{scope:object;raw:string|null}|null>(null);
  const manualReady=manualRecord?.scope===manualScope,manualRetained=manualReady?manualRecord.raw:null;
  useLayoutEffect(()=>{manualCurrent.current=manualScope;return()=>{manualCurrent.current=null;invalidateManual();};},[manualScope,invalidateManual]);
  useEffect(()=>{
    const reload=()=>{invalidateManual();try{setManualRecord({scope:manualScope,raw:window.sessionStorage.getItem(manualKey)});}catch{setManualRecord(null);setMessage('Recovery storage is unavailable. No new manual roster request was sent, and existing recovery data was not cleared.');}};
    reload();const changed=(event:StorageEvent)=>{if(event.storageArea===window.sessionStorage&&event.key===manualKey){reload();setManualPending(null);}};
    window.addEventListener('storage',changed);
    let unsubscribe:(()=>void)|undefined;
    try{const subscription=createClient().auth.onAuthStateChange(event=>{if(event!=='INITIAL_SESSION')invalidateManual();});unsubscribe=()=>subscription.data.subscription.unsubscribe();}catch{/* Actions independently verify the current identity. */}
    return()=>{invalidateManual();window.removeEventListener('storage',changed);unsubscribe?.();};
  },[manualScope,manualKey,invalidateManual]);
  function manualOwns(epoch:number,raw:string|null){if(manualCurrent.current!==manualScope||manualEpoch.current!==epoch||window.sessionStorage.getItem(manualKey)!==raw)throw Error('manual_context_changed');assertRecoveryWriteAllowed();}
  async function manualIdentity(epoch:number,raw:string|null,expectedSession?:string){
    manualOwns(epoch,raw);const client=createClient(),identity=await requireVerifiedIdentity(client);manualOwns(epoch,raw);
    if(!identity||identity.subject!==actorId||!isUuid(identity.sessionId)||expectedSession&&identity.sessionId!==expectedSession)throw Error('manual_identity_changed');
    const user=await client.auth.getUser();manualOwns(epoch,raw);if(user.error||user.data.user?.id!==actorId)throw Error('manual_identity_changed');const final=await requireVerifiedIdentity(client);manualOwns(epoch,raw);if(final?.subject!==actorId||final.sessionId!==identity.sessionId)throw Error('manual_identity_changed');return identity.sessionId;
  }
  async function recoverManual(){
    if(busy||manualFlight.current||!manualReady||manualRetained===null)return;
    const raw=manualRetained,operationId=manualRetainedOperationV22(raw);if(!operationId){setMessage('Unrecognized manual recovery data is preserved. Do not replace it with another entry.');return;}
    const epoch=manualEpoch.current;manualFlight.current=true;setBusy(true);setMessage(null);
    try{await trackAppRecoveryWrite(async()=>{
      const sessionId=await manualIdentity(epoch,raw);
      const response=await fetch(`/api/v1/tournaments/${tournamentId}/roster-manual/recovery-v22`,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify({idempotencyKey:operationId})});
      await manualIdentity(epoch,raw,sessionId);const value:unknown=await response.json().catch(()=>null);await manualIdentity(epoch,raw,sessionId);
      if(response.ok&&acceptedManualRecoveryV22(value,{actorId,tournamentId,sessionId,operationId})&&transitionAppRecoveryItem(window.sessionStorage,manualKey,raw,null)){
        setManualRecord({scope:manualScope,raw:null});setManualPending(null);setFirstName('');setLastName('');setEmail('');setAccNumber('');setScorecardType('digital');setMessage('The prior manual entry was accepted. The roster is refreshing.');router.refresh();
      }else setMessage('The prior manual entry is unresolved. Recovery data is preserved; no new player was added.');
    });}catch{if(manualCurrent.current===manualScope)setMessage('The prior manual entry could not be verified. Recovery data is preserved.');}
    finally{manualFlight.current=false;if(manualCurrent.current===manualScope)setBusy(false);}
  }

  async function reconcilePromotion(envelope: PromotionEnvelope) {
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/roster-promotions/reconciliation`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(envelope) });
      const payload: unknown = await response.json().catch(() => null);
      return response.ok ? rosterPromotionReconciliation(payload, envelope.approvalDecisionId) : "unresolved";
    } catch { return "unresolved"; }
  }
  // `reconcilePromotion` is intentionally local so its request scope remains this tournament.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void (async () => { try { const raw = window.sessionStorage.getItem(promotionKey); const envelope: unknown = raw ? JSON.parse(raw) : null; if (!envelope || typeof envelope !== "object" || typeof (envelope as PromotionEnvelope).approvalDecisionId !== "string" || typeof (envelope as PromotionEnvelope).idempotencyKey !== "string") return; setLocked(envelope as PromotionEnvelope); const state = await reconcilePromotion(envelope as PromotionEnvelope); if (state !== "unresolved") { window.sessionStorage.removeItem(promotionKey); setLocked(null); if (state === "accepted") { setMessage("The prior roster request was accepted. The roster is refreshing."); router.refresh(); } else setMessage("The prior roster request was rejected. Review registration status and the candidate before trying a new request."); } else { setMessage("A prior roster request has no confirmed server receipt. Retry the exact request before creating another roster identity."); } } catch { /* Storage is optional until a new action starts. */ } finally { setPromotionReady(true); } })(); }, [promotionKey, router, tournamentId]);

  async function promote(envelope: PromotionEnvelope) {
    if (busy || promotionFlight.current) return; promotionFlight.current = true; const body = envelope; setBusy(true); setLocked(envelope); setMessage(null);
    try { const response = await send("roster-promotions", body), payload: unknown = await response.json().catch(() => null);
      if (response.ok && isAcceptedRosterPromotion(payload, body.approvalDecisionId)) { window.sessionStorage.removeItem(promotionKey); setLocked(null); router.refresh(); return; }
      if (response.status === 409 && isRejectedRosterPromotion(payload, body.approvalDecisionId)) { window.sessionStorage.removeItem(promotionKey);
        setLocked(null); const code = (payload as { code: string }).code; setMessage(code === "registration_closed" || code === "initial_seating_already_published" ? rosterIntakeMessage(intakeState === "setup_required" ? "setup_required" : "closed") : code === "withdrawn_roster_entry" ? "This player was previously withdrawn. Reinstate the existing roster identity instead." : code === "duplicate_roster_entry" ? "That registration matches an active roster identity." : code === "potential_duplicate" ? "A possible name or email match needs director review before promotion." : "The roster action was rejected. Review registration status: finalize events in Setup to open intake, or review the guarded registration and seating correction workflow if intake is closed."); return; }
      setMessage("The roster request is unresolved. Refresh the roster before retrying.");
    } catch { setMessage("The roster request is unresolved. Retry the exact saved request."); } finally { promotionFlight.current = false; setBusy(false); }
  }

  async function submitManual(body: ManualRosterEntryRequest) {
    if (busy || manualFlight.current || !manualReady || manualRetained!==null && manualPending!==body) return; const epoch=manualEpoch.current; let raw=manualRetained; manualFlight.current=true; setBusy(true); setManualPending(body); setMessage(null);
    try { await trackAppRecoveryWrite(async()=>{
      const sessionId=await manualIdentity(epoch,raw);
      if(raw===null){const next=JSON.stringify({kind:'manual-roster',idempotencyKey:body.idempotencyKey});if(!transitionAppRecoveryItem(window.sessionStorage,manualKey,null,next))throw Error('manual_record_changed');raw=next;setManualRecord({scope:manualScope,raw});}
      if(manualRetainedOperationV22(raw)!==body.idempotencyKey)throw Error('manual_record_changed');
    try { const response = await send("roster-manual", body); await manualIdentity(epoch,raw,sessionId); const payload: unknown = await response.json().catch(() => null); await manualIdentity(epoch,raw,sessionId);
      if (response.ok && isAcceptedManualRosterEntry(payload)) { if(!transitionAppRecoveryItem(window.sessionStorage,manualKey,raw,null))throw Error('manual_record_changed');setManualRecord({scope:manualScope,raw:null});
        setManualPending(null); setFirstName(""); setLastName(""); setEmail(""); setAccNumber("");
        // Reset the scorecard type with the rest of the form. Leaving it sticky
        // while every other field clears reads as an empty form, so the next
        // player silently inherits the previous one's type. Digital is the
        // documented default everywhere else, including the CSV import.
        setScorecardType("digital"); setMessage("Player added to the roster."); router.refresh(); return; }
      if (response.status === 409 && isRejectedManualRosterEntry(payload)) { if(!transitionAppRecoveryItem(window.sessionStorage,manualKey,raw,null))throw Error('manual_record_changed');setManualRecord({scope:manualScope,raw:null});
        setManualPending(null); const code = (payload as { code: string }).code; setMessage(code === "registration_closed" ? rosterIntakeMessage(intakeState === "setup_required" ? "setup_required" : "closed") : code === "initial_seating_already_published" ? rosterIntakeMessage("closed") : code === "withdrawn_roster_entry" ? "This player was previously withdrawn. Reinstate the existing roster identity instead." : code === "duplicate_roster_entry" ? "That player is already on this tournament roster." : code === "potential_duplicate" ? "A possible name or email match needs director review. Use the existing roster identity or resolve it first." : "The tournament server did not accept that manual roster entry."); return; }
      setMessage("The manual entry is unresolved. Refresh the roster before entering that player again.");
    } catch { if(manualCurrent.current===manualScope)setMessage("The manual entry is unresolved. Recovery data is preserved. Recover the prior entry before adding another."); }
    }); }catch{if(manualCurrent.current===manualScope)setMessage('The manual entry could not be safely completed. Recovery data is preserved.');}finally{manualFlight.current=false;if(manualCurrent.current===manualScope)setBusy(false);}
  }
  function createManual(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!manualReady || manualRetained!==null || !firstName.trim() || !lastName.trim()) return; void submitManual({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), accNumber: accNumber.trim(), scorecardType, idempotencyKey: crypto.randomUUID() }); }

  function downloadRosterTemplate() {
    const blob = new Blob(["First Name,Last Name,Email,ACC #,Scorecard Type\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tournament-player-list-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

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
      if (response.status === 409 && isRejectedRosterCsvImport(payload)) { const code = (payload as { code: string }).code; setMessage(code === "registration_closed" ? rosterIntakeMessage(intakeState === "setup_required" ? "setup_required" : "closed") : code === "initial_seating_already_published" ? rosterIntakeMessage("closed") : code === "withdrawn_roster_entry" ? "A CSV player was previously withdrawn. Reinstate the existing identity instead. No players were imported." : code === "duplicate_roster_entry" ? "At least one CSV entry is already on the roster. No players were imported." : code === "potential_duplicate" ? "A CSV row has a possible name or email match. No players were imported." : "The tournament server rejected this import. No players were imported."); return; }
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

  return <section className="policy-settings"><aside className="auth-note" aria-label="Roster prerequisites"><p>{rosterIntakeMessage(intakeState)}</p><Link className="guide-link" href={`/tournament/${tournamentId}/setup`}>Review setup and open registration</Link><Link className="guide-link" href={`/tournament/${tournamentId}/seating`}>Review tournament check-in and registration closure</Link></aside>
    <section className="manual-roster-panel" aria-labelledby="csv-roster-title"><h2 id="csv-roster-title">Import Player List</h2><p>Use separate <strong>First Name</strong> and <strong>Last Name</strong> columns. <strong>Email</strong>, <strong>ACC #</strong>, and <strong>Scorecard Type</strong> are optional. ACC # must be a two-letter state abbreviation followed immediately by the number, such as <strong>HI296</strong>, or <strong>HI296Y</strong> for a youth player. Scorecard Type accepts Digital or Paper and defaults to Digital. The full file is checked before anyone is added.</p><div className="roster-csv-controls"><button className="secondary" type="button" onClick={downloadRosterTemplate}>Download CSV template</button><label>Player CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => void selectCsv(event)} /></label><button className="primary" type="button" disabled={busy || intakeState !== "open" || !csvRows.length} onClick={() => void importCsv()}>Import {csvRows.length || ""} Player{csvRows.length === 1 ? "" : "s"}</button></div>{csvFileName ? <p><strong>{csvFileName}</strong> · {csvRows.length} validated row{csvRows.length === 1 ? "" : "s"}</p> : null}</section>
    <section className="manual-roster-panel" aria-labelledby="manual-roster-title"><h2 id="manual-roster-title">Add Player Manually</h2><p>Use this fallback for a phone, paper list, or spreadsheet entry. Email and ACC number are optional.</p><form className="manual-roster-form" onSubmit={createManual}><label>First Name<input disabled={busy || manualRetained!==null} required maxLength={80} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>Last Name<input disabled={busy || manualRetained!==null} required maxLength={80} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label><label>Email (Optional)<input disabled={busy || manualRetained!==null} maxLength={320} inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>ACC # (Optional)<input disabled={busy || manualRetained!==null} maxLength={64} autoCapitalize="characters" value={accNumber} onChange={(event) => setAccNumber(normalizeAccNumberInput(event.target.value))} /><span className="field-help">Use HI296, or HI296Y for a youth player.</span></label><label>Scorecard Type<select disabled={busy || manualRetained!==null} value={scorecardType} onChange={(event) => setScorecardType(event.target.value as "digital" | "paper")}><option value="digital">Digital</option><option value="paper">Paper</option></select></label><button className="primary" type="submit" disabled={busy || !manualReady || manualRetained!==null || !!manualPending || intakeState !== "open" || !firstName.trim() || !lastName.trim()}>Add Player</button></form>{manualReady&&manualRetained!==null&&<aside aria-label="Prior manual entry recovery"><p>A prior manual entry still needs verification. Do not add the same player again.</p><button type="button" disabled={busy||!manualRetainedOperationV22(manualRetained)} onClick={()=>void recoverManual()}>Recover prior manual entry</button>{!manualRetainedOperationV22(manualRetained)&&<p>Unrecognized recovery data is preserved.</p>}</aside>}{manualPending ? <button className="primary" type="button" disabled={busy} onClick={() => void submitManual(manualPending)}>{busy ? "Adding player…" : "Retry manual entry"}</button> : null}</section>
    {locked && !busy ? <button className="primary" type="button" onClick={() => void promote(locked)}>Retry exact roster request</button> : null}<h2>Approved registration candidates</h2><p>Payment preference is unverified and is not payment. Promoting a candidate creates only a private roster identity snapshot.</p>{promotionCandidates.length ? <ul>{promotionCandidates.map((candidate) => <li key={candidate.approvalDecisionId}><strong>{candidate.displayName}</strong> · {candidate.email}{candidate.accNumber ? ` · ${candidate.accNumber}` : ""} · {candidate.scorecardType} scorecard · planned {candidate.intendedPaymentMethod}<button className="primary" type="button" disabled={busy || !promotionReady || !!locked || intakeState !== "open"} onClick={() => { if (promotionFlight.current || locked || !promotionReady) return; const envelope = { approvalDecisionId: candidate.approvalDecisionId, idempotencyKey: crypto.randomUUID() }; try { setAppRecoveryItem(window.sessionStorage, promotionKey, JSON.stringify(envelope)); } catch { setMessage("Enable session storage before continuing."); return; } setLocked(envelope); void promote(envelope); }}>Create approved roster identity</button></li>)}</ul> : <p>No reviewed registrations are waiting for roster creation.</p>}
    <h2>Roster identities</h2>{rosterEntries.length ? <ul>{rosterEntries.map((entry) => <li key={entry.rosterEntryId}><strong>{entry.displayName}</strong>{entry.email ? ` · ${entry.email}` : ""}{entry.accNumber ? ` · ${entry.accNumber}` : ""} <span className="status-pill">{entry.source === "director_manual" ? "Manual" : entry.source === "director_csv" ? "CSV" : "Registration"}</span><label>Scorecard Type<select aria-label={`Scorecard Type for ${entry.displayName}`} value={entry.scorecardType} disabled={busy} onChange={(event) => void updateScorecardPreference(entry, event.target.value as "digital" | "paper")}><option value="digital">Digital</option><option value="paper">Paper</option></select></label><button type="button" disabled={busy} onClick={() => { setResolveTarget(entry); setReasonCode("duplicate_entry"); setNote(""); }}>Remove from active roster</button></li>)}</ul> : <p>No active roster identities have been created.</p>}
    {resolveTarget ? <section className="manual-roster-panel" aria-labelledby="resolve-roster-entry"><h2 id="resolve-roster-entry">Remove {resolveTarget.displayName} from active roster</h2><p><strong>You are removing the existing active roster record—not resolving a pending registration.</strong></p><p>This preserves the registration, payments, seating, and audit history. It removes only the active roster identity from future enrollment, seating, and scheduling.</p><label>Reason<select value={reasonCode} onChange={(event) => setReasonCode(event.target.value as RosterStatusRequest["reasonCode"])}><option value="duplicate_entry">Duplicate entry</option><option value="player_withdrew">Player withdrew</option><option value="unable_to_attend">Unable to attend</option><option value="administrative_correction">Administrative correction</option><option value="other">Other</option></select></label><label>Note {reasonCode === "other" ? "(required)" : "(optional)"}<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="primary" type="button" disabled={busy || (reasonCode === "other" && !note.trim())} onClick={() => void setRosterStatus(resolveTarget, "withdraw")}>Remove from active roster</button><button type="button" disabled={busy} onClick={() => setResolveTarget(null)}>Cancel</button></section> : null}
    {withdrawnRosterEntries.length ? <details onToggle={(event) => setWithdrawnExpanded((event.currentTarget as HTMLDetailsElement).open)}><summary>{withdrawnExpanded ? "▾" : "▸"} Withdrawn / resolved records ({withdrawnRosterEntries.length}) — click to {withdrawnExpanded ? "hide" : "view"} list</summary><ul>{withdrawnRosterEntries.map((entry) => <li key={entry.rosterEntryId}><strong>{entry.displayName}</strong> · {entry.reasonCode?.replaceAll("_", " ") ?? "resolved"}{entry.note ? ` · ${entry.note}` : ""}<button type="button" disabled={busy} onClick={() => { setReinstateTarget(entry); setReasonCode("administrative_correction"); setNote(""); }}>Reinstate</button></li>)}</ul></details> : null}
    {reinstateTarget ? <section className="manual-roster-panel" aria-labelledby="reinstate-roster-entry"><h2 id="reinstate-roster-entry">Reinstate {reinstateTarget.displayName}</h2><p>This restores the original roster identity. It does not create a second player record or alter history.</p><button className="primary" type="button" disabled={busy} onClick={() => void setRosterStatus(reinstateTarget, "reinstate")}>Yes, reinstate original identity</button><button type="button" disabled={busy} onClick={() => setReinstateTarget(null)}>Cancel</button></section> : null}
    {message ? <p className="error-text" role="status">{message}</p> : null}
  </section>;
}
