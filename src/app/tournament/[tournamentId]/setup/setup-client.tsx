"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isSavedSetup, isSetupOfficialChoices, isSetupSaveRequest, isSetupWorkspace,
  type SetupEvent, type SetupOfficialChoices, type SetupPayload, type SetupPool, type SetupSaveRequest,
} from "../../../../lib/api/setup";
import {
  isRejectedSetupActivation,
  isSetupActivationResult,
  isSetupActivationState,
  type SetupActivationRequest,
  type SetupActivationState,
} from "../../../../lib/api/setup-activation";
import {
  isRejectedSetupAmendment,
  isSetupAmendmentRequest,
  isSetupAmendmentResult,
  type SetupAmendmentRequest,
} from "../../../../lib/api/setup-amendment";
import { formatUsdInput, parseUsdMinor } from "../../../../lib/money";

type PendingSave = { kind: "tournament-setup"; request: SetupSaveRequest };
type PendingActivation = { kind: "tournament-activation"; request: SetupActivationRequest };
type PendingAmendment = { kind: "tournament-setup-amendment"; request: SetupAmendmentRequest };
const eventLabels: Record<SetupEvent["eventKind"], string> = { main: "Main Event", consolation: "Consolation Event", satellite: "Satellite Event", custom: "Custom Event" };
const styleOptions: Record<SetupEvent["eventKind"], string[]> = { main: ["Standard", "Double Elimination"], consolation: ["Standard", "Consy Lite"], satellite: ["Standard", "Doubles", "Canadian Doubles"], custom: ["Custom"] };
const gameOptions: Record<SetupEvent["eventKind"], number[]> = { main: [9, 10, 11, 12, 18, 20, 22], consolation: [7, 8, 9, 10], satellite: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18], custom: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 20, 22] };
const qPoolOptions = ["Equal (Pays All Equally)", "Equal (Top Qualifier Paid Double)", "Graduated (1-in-4)", "Graduated (1-in-6)", "Graduated (1-in-8)", "Graduated (1-in-10)"];
const satellitePayoutOptions = ["1 in 4", "1 in 5", "1 in 6", "Top 4"];

function formatForStyle(style: string) {
  if (style === "Doubles") return "doubles";
  if (style === "Canadian Doubles") return "canadian_doubles";
  return "standard_singles";
}

function defaultEvent(kind: SetupEvent["eventKind"], startsAt = "", timezone = "UTC"): SetupEvent {
  return { clientRowId: crypto.randomUUID(), eventKind: kind, displayName: eventLabels[kind], startsAt, timezone, styleCode: styleOptions[kind][0], formatCode: "standard_singles", gameCount: gameOptions[kind][0], entryFeeCents: 0, feeIncludesNote: "", payoutNote: "", qualificationNote: "", eligibilityNote: "", mugginsStatus: "unset", qPools: [] };
}
function blankPayload(choices: SetupOfficialChoices): SetupPayload {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return { tournamentName: "", city: "", venue: "", startsAt: "", endsAt: "", timezone, contactDetails: "", sanctioningFeeCents: null, officials: [{ profileId: choices.directorProfileId, role: "director" }, ...choices.coDirectorProfileIds.map((profileId) => ({ profileId, role: "co_director" as const }))], events: [] };
}
function readPending(key: string): PendingSave | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null"); return value && typeof value === "object" && (value as PendingSave).kind === "tournament-setup" && isSetupSaveRequest((value as PendingSave).request) ? value as PendingSave : null; } catch { return null; } }
function storePending(key: string, value: PendingSave | PendingActivation | PendingAmendment) { try { sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function clearPending(key: string) { try { sessionStorage.removeItem(key); } catch { /* accepted server receipt remains authoritative */ } }
function readPendingActivation(key: string): PendingActivation | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null"); const request = value && typeof value === "object" ? (value as PendingActivation).request : null; return value && typeof value === "object" && (value as PendingActivation).kind === "tournament-activation" && request && typeof request === "object" && typeof request.setupRevisionId === "string" && Number.isSafeInteger(request.expectedVersion) && typeof request.idempotencyKey === "string" ? value as PendingActivation : null; } catch { return null; } }
function readPendingAmendment(key: string): PendingAmendment | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null"); return value && typeof value === "object" && (value as PendingAmendment).kind === "tournament-setup-amendment" && isSetupAmendmentRequest((value as PendingAmendment).request) ? value as PendingAmendment : null; } catch { return null; } }
function editableEvent(event: SetupEvent & { sourceStatus?: string; qPools: Array<SetupPool & { slot?: number; sourceStatus?: string }> }): SetupEvent {
  const { clientRowId, eventKind, displayName, startsAt, timezone, styleCode, formatCode, gameCount, entryFeeCents, feeIncludesNote, payoutNote, qualificationNote, eligibilityNote, mugginsStatus } = event;
  return { clientRowId, eventKind, displayName, startsAt: startsAt.slice(0, 16), timezone, styleCode, formatCode, gameCount, entryFeeCents, feeIncludesNote, payoutNote, qualificationNote, eligibilityNote, mugginsStatus, qPools: event.qPools.map(({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note }) => ({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note })) };
}

function MoneyInput({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  const [draft, setDraft] = useState(() => formatUsdInput(value));
  const parsed = draft === "" ? null : parseUsdMinor(draft, { allowZero: true, maxMinor: 100_000_000 });
  const invalid = draft !== "" && parsed === null;
  return <label>{label}<span className="money-input"><span aria-hidden="true">$</span><input
    aria-invalid={invalid} inputMode="decimal" placeholder="0.00" value={draft}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={() => {
      if (invalid) { setDraft(formatUsdInput(value)); return; }
      onChange(parsed);
    }}
  /></span></label>;
}
function PoolEditor({ pool, index, update, remove }: { pool: SetupPool; index: number; update: (value: SetupPool) => void; remove: () => void }) {
  return <fieldset className="setup-subsection"><legend>Q Pool {index + 1}</legend>
    <label>Pool type<select required value={pool.poolTypeCode} onChange={(event) => update({ ...pool, poolTypeCode: event.target.value })}><option value="">Select a Q Pool type</option>{qPoolOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
    <MoneyInput key={`pool-fee-${pool.entryFeeCents}`} label="Entry fee" value={pool.entryFeeCents} onChange={(entryFeeCents) => update({ ...pool, entryFeeCents: entryFeeCents ?? 0 })} />
    <label>Optional note<input maxLength={1000} value={pool.note} onChange={(event) => update({ ...pool, note: event.target.value })} /></label>
    <button type="button" className="secondary" onClick={remove}>Remove Q Pool</button>
  </fieldset>;
}
function EventEditor({ event, number, update, remove }: { event: SetupEvent; number: number; update: (value: SetupEvent) => void; remove: () => void }) {
  const canPool = event.eventKind === "main" || event.eventKind === "consolation";
  return <fieldset className="setup-event"><legend>{eventLabels[event.eventKind]} {number}</legend>
    <div className="setup-grid">
      <label>Event name<input required maxLength={200} value={event.displayName} onChange={(e) => update({ ...event, displayName: e.target.value })} /></label>
      <label>Style<select value={event.styleCode} onChange={(e) => update({ ...event, styleCode: e.target.value, formatCode: formatForStyle(e.target.value) })}>{styleOptions[event.eventKind].map((option) => <option key={option}>{option}</option>)}</select></label>
      <label>Games<select value={event.gameCount} onChange={(e) => update({ ...event, gameCount: Number(e.target.value) })}>{gameOptions[event.eventKind].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      <MoneyInput key={`event-fee-${event.entryFeeCents}`} label="Entry fee" value={event.entryFeeCents} onChange={(entryFeeCents) => update({ ...event, entryFeeCents: entryFeeCents ?? 0 })} />
      <label>Start date and time<input required type="datetime-local" value={event.startsAt} onChange={(e) => update({ ...event, startsAt: e.target.value })} /></label>
      <label>Fee includes<input maxLength={1000} value={event.feeIncludesNote} onChange={(e) => update({ ...event, feeIncludesNote: e.target.value })} placeholder="Coffee, lunch, etc." /></label>
      {event.eventKind === "satellite" ? <label>Payout<select value={event.payoutNote} onChange={(e) => update({ ...event, payoutNote: e.target.value })}><option value="">Select a payout</option>{satellitePayoutOptions.map((option) => <option key={option}>{option}</option>)}</select></label> : <label className="setup-wide">Payout information<textarea maxLength={2000} value={event.payoutNote} onChange={(e) => update({ ...event, payoutNote: e.target.value })} /></label>}
    </div>
    {canPool ? <section><h3>Q Pools</h3>{event.qPools.map((pool, index) => <PoolEditor key={`${event.clientRowId}-${index}`} pool={pool} index={index} update={(value) => update({ ...event, qPools: event.qPools.map((item, poolIndex) => poolIndex === index ? value : item) })} remove={() => update({ ...event, qPools: event.qPools.filter((_, poolIndex) => poolIndex !== index) })} />)}<button type="button" className="secondary" disabled={event.qPools.length >= 2} onClick={() => update({ ...event, qPools: [...event.qPools, { poolTypeCode: "", entryFeeCents: 0, note: "" }] })}>Add Q Pool</button></section> : null}
    <button type="button" className="secondary danger-button" onClick={remove}>Remove event</button>
  </fieldset>;
}

export default function SetupClient({ actorId, tournamentId, activationEnabled }: { actorId: string; tournamentId: string; activationEnabled: boolean }) {
  const storageKey = `tournament-setup:${actorId}:${tournamentId}`, activationStorageKey = `tournament-activation:${actorId}:${tournamentId}`, amendmentStorageKey = `tournament-setup-amendment:${actorId}:${tournamentId}`, inFlight = useRef(false);
  const [payload, setPayload] = useState<SetupPayload | null>(null), [savedFingerprint, setSavedFingerprint] = useState(""), [revisionId, setRevisionId] = useState<string | null>(null), [version, setVersion] = useState(0), [busy, setBusy] = useState(true), [pending, setPending] = useState<PendingSave | null>(null), [pendingActivation, setPendingActivation] = useState<PendingActivation | null>(null), [activationState, setActivationState] = useState<SetupActivationState>({ status: "not_activated" }), [message, setMessage] = useState("Loading tournament setup…");
  const [amendmentEvents, setAmendmentEvents] = useState<SetupEvent[]>([]), [pendingAmendment, setPendingAmendment] = useState<PendingAmendment | null>(null);
  const load = useCallback(async () => {
    const [response, activationResponse] = await Promise.all([
      fetch(`/api/v1/tournaments/${tournamentId}/setup`, { credentials: "same-origin", cache: "no-store" }),
      activationEnabled ? fetch(`/api/v1/tournaments/${tournamentId}/setup/activation`, { credentials: "same-origin", cache: "no-store" }) : Promise.resolve(null),
    ]);
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== "object") throw new Error("load");
    const result = data as Record<string, unknown>;
    if (!isSetupWorkspace(result.workspace) || !isSetupOfficialChoices(result.officialChoices)) throw new Error("shape");
    const current = result.workspace.current;
    const nextPayload = current ? { tournamentName: current.tournamentName, city: current.city, venue: current.venue, startsAt: current.startsAt.slice(0, 16), endsAt: current.endsAt.slice(0, 16), timezone: current.timezone, contactDetails: current.contactDetails, sanctioningFeeCents: current.sanctioningFeeCents, officials: current.officials, events: current.events.map(editableEvent) } : blankPayload(result.officialChoices);
    setPayload(nextPayload);
    setSavedFingerprint(current ? JSON.stringify(nextPayload) : "");
    setRevisionId(current?.revisionId ?? null);
    setVersion(current?.version ?? 0);
    let nextActivation: SetupActivationState = { status: "not_activated" };
    if (activationResponse) {
      const activationData: unknown = await activationResponse.json().catch(() => null);
      if (!activationResponse.ok || !isSetupActivationState(activationData)) throw new Error("activation-load");
      nextActivation = activationData;
      setActivationState(activationData);
    }
    setMessage(nextActivation.status === "activated" ? `${nextActivation.eventCount} tournament event${nextActivation.eventCount === 1 ? "" : "s"} activated.` : current ? `Saved setup version ${current.version} is loaded.` : "Enter the tournament details, then save the first version.");
    return nextActivation;
  }, [activationEnabled, tournamentId]);
  useEffect(() => { void (async () => { try { const active = await load(); const recoveredActivation = readPendingActivation(activationStorageKey); if (active.status === "activated") clearPending(activationStorageKey); else if (recoveredActivation) { setPendingActivation(recoveredActivation); setMessage("A previous activation may be unresolved. Retry the exact request."); } const recovered = readPending(storageKey); if (recovered && active.status !== "activated") { setPending(recovered); setPayload(recovered.request.payload); setVersion(recovered.request.expectedVersion); setMessage("A previous save may be unresolved. Retry the exact saved version before editing."); } const recoveredAmendment = readPendingAmendment(amendmentStorageKey); if (recoveredAmendment && active.status === "activated") { setPendingAmendment(recoveredAmendment); setAmendmentEvents(recoveredAmendment.request.events); setMessage("A previous event addition may be unresolved. Retry the exact request before making another change."); } } catch { setMessage("Tournament setup is temporarily unavailable. Refresh to retry."); } finally { setBusy(false); } })(); }, [activationStorageKey, amendmentStorageKey, load, storageKey]);
  const counts = useMemo(() => payload ? payload.events.reduce((result, event) => ({ ...result, [event.eventKind]: (result[event.eventKind] ?? 0) + 1 }), {} as Record<string, number>) : {}, [payload]);
  const activated = activationState.status === "activated";
  const dirty = !!payload && JSON.stringify(payload) !== savedFingerprint;
  function updateEvent(clientRowId: string, value: SetupEvent) { if (!payload || pending || activated) return; setPayload({ ...payload, events: payload.events.map((event) => event.clientRowId === clientRowId ? value : event) }); }
  function add(kind: SetupEvent["eventKind"]) { if (!payload || pending || activated || payload.events.length >= 32 || ((kind === "main" || kind === "consolation") && counts[kind])) return; setPayload({ ...payload, events: [...payload.events, defaultEvent(kind, payload.startsAt, payload.timezone)] }); }
  async function save(envelope: PendingSave) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setPending(envelope); setMessage("Saving the tournament setup…");
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope.request) }); const data: unknown = await response.json().catch(() => null);
      if (response.ok && isSavedSetup(data, envelope.request)) { clearPending(storageKey); setPending(null); await load(); setMessage(`Tournament setup version ${data.version} was saved.`); return; }
      if (response.status === 409) { clearPending(storageKey); setPending(null); await load(); setMessage("The setup was not changed. The latest saved version is shown."); return; }
      setMessage("The save is unresolved. Retry the exact saved version when the connection is available.");
    } catch { setMessage("The save is unresolved. Retry the exact saved version when the connection is available."); } finally { inFlight.current = false; setBusy(false); }
  }
  function startSave() { if (!payload || pending || busy) return; const request = { expectedVersion: version, payload, idempotencyKey: crypto.randomUUID() }; if (!isSetupSaveRequest(request)) { setMessage("Complete every required tournament and event field before saving."); return; } const envelope: PendingSave = { kind: "tournament-setup", request }; if (!storePending(storageKey, envelope)) { setMessage("This browser cannot safely retain the request for recovery."); return; } void save(envelope); }
  async function activate(envelope: PendingActivation) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setPendingActivation(envelope); setMessage("Activating the tournament events…");
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup/activation`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope.request) }); const data: unknown = await response.json().catch(() => null);
      if (response.ok && isSetupActivationResult(data, envelope.request)) { clearPending(activationStorageKey); setPendingActivation(null); await load(); setMessage(`${data.eventCount} tournament event${data.eventCount === 1 ? "" : "s"} activated successfully.`); return; }
      if (response.status === 409 && isRejectedSetupActivation(data)) { clearPending(activationStorageKey); setPendingActivation(null); await load(); setMessage(data.code === "already_activated" ? "Tournament events are already activated." : "Activation was not applied. Review the saved setup and try again."); return; }
      setMessage("Activation is unresolved. Retry the exact request when the connection is available.");
    } catch { setMessage("Activation is unresolved. Retry the exact request when the connection is available."); } finally { inFlight.current = false; setBusy(false); }
  }
  function startActivation() { if (!revisionId || version < 1 || dirty || busy || pending || pendingActivation || counts.main !== 1) return; const envelope: PendingActivation = { kind: "tournament-activation", request: { setupRevisionId: revisionId, expectedVersion: version, idempotencyKey: crypto.randomUUID() } }; if (!storePending(activationStorageKey, envelope)) { setMessage("This browser cannot safely retain the activation request for recovery."); return; } void activate(envelope); }
  function addAmendmentEvent(kind: "consolation" | "satellite") { if (!payload || !activated || pendingAmendment || busy || activationState.events.length + amendmentEvents.length >= 32) return; if (kind === "consolation" && (activationState.events.some((event) => event.eventType === "consolation") || amendmentEvents.some((event) => event.eventKind === "consolation"))) return; setAmendmentEvents((events) => [...events, defaultEvent(kind, payload.startsAt, payload.timezone)]); }
  async function amend(envelope: PendingAmendment) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setPendingAmendment(envelope); setMessage("Adding the new tournament events…");
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup/amendments`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope.request) }); const data: unknown = await response.json().catch(() => null);
      if (response.ok && isSetupAmendmentResult(data, envelope.request)) { clearPending(amendmentStorageKey); setPendingAmendment(null); setAmendmentEvents([]); await load(); setMessage(`${data.addedEventCount} new tournament event${data.addedEventCount === 1 ? "" : "s"} added successfully.`); return; }
      if (response.status === 409 && isRejectedSetupAmendment(data)) { clearPending(amendmentStorageKey); setPendingAmendment(null); await load(); setMessage(data.code === "stale_setup_revision" ? "Another setup change was saved first. Review the current events before adding yours again." : "The new events were not added. Review the event details and current setup."); return; }
      setMessage("The event addition is unresolved. Retry the exact request when the connection is available.");
    } catch { setMessage("The event addition is unresolved. Retry the exact request when the connection is available."); } finally { inFlight.current = false; setBusy(false); }
  }
  function startAmendment() { if (!activated || busy || pendingAmendment || amendmentEvents.length === 0) return; const request = { expectedSetupRevisionId: activationState.setupRevisionId, expectedSetupVersion: activationState.setupVersion, events: amendmentEvents, operationId: crypto.randomUUID() }; if (!isSetupAmendmentRequest(request)) { setMessage("Complete every required new-event field before adding it."); return; } const envelope: PendingAmendment = { kind: "tournament-setup-amendment", request }; if (!storePending(amendmentStorageKey, envelope)) { setMessage("This browser cannot safely retain the event addition for recovery."); return; } void amend(envelope); }
  if (!payload) return <p className="auth-note" role="status">{message}</p>;
  return <section className="policy-settings setup-workspace"><h2>Tournament details</h2>
    <fieldset disabled={busy || !!pending || activated}><div className="setup-grid">
      <label>Tournament name<input required maxLength={200} value={payload.tournamentName} onChange={(e) => setPayload({ ...payload, tournamentName: e.target.value })} /></label><label>City<input required maxLength={160} value={payload.city} onChange={(e) => setPayload({ ...payload, city: e.target.value })} /></label><label>Venue<input required maxLength={240} value={payload.venue} onChange={(e) => setPayload({ ...payload, venue: e.target.value })} /></label><label>Time zone<input required maxLength={128} value={payload.timezone} onChange={(e) => setPayload({ ...payload, timezone: e.target.value })} /></label><label>Starts<input required type="datetime-local" value={payload.startsAt} onChange={(e) => setPayload({ ...payload, startsAt: e.target.value })} /></label><label>Ends<input required type="datetime-local" value={payload.endsAt} onChange={(e) => setPayload({ ...payload, endsAt: e.target.value })} /></label><MoneyInput key={`sanctioning-fee-${payload.sanctioningFeeCents ?? "blank"}`} label="ACC Sanctioning Fee" value={payload.sanctioningFeeCents} onChange={(sanctioningFeeCents) => setPayload({ ...payload, sanctioningFeeCents })} /><label className="setup-wide">Director contact details<textarea maxLength={1000} value={payload.contactDetails} onChange={(e) => setPayload({ ...payload, contactDetails: e.target.value })} /></label>
    </div></fieldset>
    <div className="setup-heading"><div><h2>Tournament events</h2><p>Add every event belonging to this tournament. Team formats remain paper-scored for the October pilot.</p></div><div className="setup-actions"><button type="button" className="secondary" disabled={busy || !!pending || activated || !!counts.main} onClick={() => add("main")}>Add Main Event</button><button type="button" className="secondary" disabled={busy || !!pending || activated || !!counts.consolation} onClick={() => add("consolation")}>Add Consolation Event</button><button type="button" className="secondary" disabled={busy || !!pending || activated || payload.events.length >= 32} onClick={() => add("satellite")}>Add Satellite Event</button></div></div>
    <fieldset disabled={busy || !!pending || activated}><legend className="sr-only">Configured tournament events</legend>{payload.events.map((event, index) => <EventEditor key={event.clientRowId} event={event} number={index + 1} update={(value) => updateEvent(event.clientRowId, value)} remove={() => !pending && !activated && setPayload({ ...payload, events: payload.events.filter((candidate) => candidate.clientRowId !== event.clientRowId) })} />)}</fieldset>
    {payload.events.length === 0 ? <p className="auth-note">Add at least one event before saving.</p> : null}<p role="status" aria-live="polite" className={message.includes("unavailable") || message.includes("unresolved") || message.includes("Complete") ? "error-text" : "auth-note"}>{message}</p>
    {activated ? <><section className="setup-activation-summary"><h2>Tournament events are active</h2><p>Standard Singles events are ready for digital operations. Team and doubles events remain paper-scored.</p><ul>{activationState.events.map((event) => <li key={event.eventId}><strong>{event.name}</strong> — {event.gameCount} games, {event.scoringMethod === "digital" ? "digital scoring" : "paper scoring"}</li>)}</ul></section><section className="setup-amendment"><div className="setup-heading"><div><h2>Add a later event</h2><p>Add a Consolation or Satellite event without changing any active event.</p></div><div className="setup-actions"><button type="button" className="secondary" disabled={busy || !!pendingAmendment || activationState.events.some((event) => event.eventType === "consolation") || amendmentEvents.some((event) => event.eventKind === "consolation")} onClick={() => addAmendmentEvent("consolation")}>Add Consolation Event</button><button type="button" className="secondary" disabled={busy || !!pendingAmendment || activationState.events.length + amendmentEvents.length >= 32} onClick={() => addAmendmentEvent("satellite")}>Add Satellite Event</button></div></div><fieldset disabled={busy || !!pendingAmendment}><legend className="sr-only">New tournament events</legend>{amendmentEvents.map((event, index) => <EventEditor key={event.clientRowId} event={event} number={activationState.events.length + index + 1} update={(value) => setAmendmentEvents((events) => events.map((candidate) => candidate.clientRowId === value.clientRowId ? value : candidate))} remove={() => setAmendmentEvents((events) => events.filter((candidate) => candidate.clientRowId !== event.clientRowId))} />)}</fieldset>{pendingAmendment ? <button type="button" className="primary" disabled={busy} onClick={() => void amend(pendingAmendment)}>Retry Exact Event Addition</button> : amendmentEvents.length > 0 ? <button type="button" className="primary" disabled={busy} onClick={startAmendment}>Add New Tournament Events</button> : null}</section></> : pending ? <button type="button" className="primary" disabled={busy} onClick={() => void save(pending)}>Retry exact saved request</button> : <div className="setup-actions"><button type="button" className="primary" disabled={busy || payload.events.length === 0 || !dirty} onClick={startSave}>Save Tournament Setup</button>{activationEnabled && revisionId && counts.main === 1 ? pendingActivation ? <button type="button" className="primary" disabled={busy} onClick={() => void activate(pendingActivation)}>Retry Tournament Activation</button> : <button type="button" className="primary" disabled={busy || dirty} onClick={startActivation}>Activate Tournament Events</button> : null}</div>}
  </section>;
}
