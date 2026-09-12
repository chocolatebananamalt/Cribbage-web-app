"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isSavedSetup, isSetupOfficialChoices, isSetupSaveRequest, isSetupWorkspace,
  type SetupEvent, type SetupOfficialChoices, type SetupPayload, type SetupPool, type SetupSaveRequest,
} from "../../../../lib/api/setup";

type PendingSave = { kind: "tournament-setup"; request: SetupSaveRequest };
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

function cents(value: string) { const amount = Number(value); return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0; }
function dollars(value: number | null) { return value === null ? "" : (value / 100).toFixed(2); }
function defaultEvent(kind: SetupEvent["eventKind"], startsAt = "", timezone = "UTC"): SetupEvent {
  return { clientRowId: crypto.randomUUID(), eventKind: kind, displayName: eventLabels[kind], startsAt, timezone, styleCode: styleOptions[kind][0], formatCode: "standard_singles", gameCount: gameOptions[kind][0], entryFeeCents: 0, feeIncludesNote: "", payoutNote: "", qualificationNote: "", eligibilityNote: "", mugginsStatus: "unset", qPools: [] };
}
function blankPayload(choices: SetupOfficialChoices): SetupPayload {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return { tournamentName: "", city: "", venue: "", startsAt: "", endsAt: "", timezone, contactDetails: "", sanctioningFeeCents: null, officials: [{ profileId: choices.directorProfileId, role: "director" }, ...choices.coDirectorProfileIds.map((profileId) => ({ profileId, role: "co_director" as const }))], events: [] };
}
function readPending(key: string): PendingSave | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null"); return value && typeof value === "object" && (value as PendingSave).kind === "tournament-setup" && isSetupSaveRequest((value as PendingSave).request) ? value as PendingSave : null; } catch { return null; } }
function storePending(key: string, value: PendingSave) { try { sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function clearPending(key: string) { try { sessionStorage.removeItem(key); } catch { /* accepted server receipt remains authoritative */ } }
function editableEvent(event: SetupEvent & { sourceStatus?: string; qPools: Array<SetupPool & { slot?: number; sourceStatus?: string }> }): SetupEvent {
  const { clientRowId, eventKind, displayName, startsAt, timezone, styleCode, formatCode, gameCount, entryFeeCents, feeIncludesNote, payoutNote, qualificationNote, eligibilityNote, mugginsStatus } = event;
  return { clientRowId, eventKind, displayName, startsAt: startsAt.slice(0, 16), timezone, styleCode, formatCode, gameCount, entryFeeCents, feeIncludesNote, payoutNote, qualificationNote, eligibilityNote, mugginsStatus, qPools: event.qPools.map(({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note }) => ({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note })) };
}

function MoneyInput({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return <label>{label}<span className="money-input"><span aria-hidden="true">$</span><input inputMode="decimal" min="0" step="0.01" value={dollars(value)} onChange={(event) => onChange(event.target.value === "" ? null : cents(event.target.value))} /></span></label>;
}
function PoolEditor({ pool, index, update, remove }: { pool: SetupPool; index: number; update: (value: SetupPool) => void; remove: () => void }) {
  return <fieldset className="setup-subsection"><legend>Q Pool {index + 1}</legend>
    <label>Pool type<select required value={pool.poolTypeCode} onChange={(event) => update({ ...pool, poolTypeCode: event.target.value })}><option value="">Select a Q Pool type</option>{qPoolOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
    <MoneyInput label="Entry fee" value={pool.entryFeeCents} onChange={(entryFeeCents) => update({ ...pool, entryFeeCents: entryFeeCents ?? 0 })} />
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
      <MoneyInput label="Entry fee" value={event.entryFeeCents} onChange={(entryFeeCents) => update({ ...event, entryFeeCents: entryFeeCents ?? 0 })} />
      <label>Start date and time<input required type="datetime-local" value={event.startsAt} onChange={(e) => update({ ...event, startsAt: e.target.value })} /></label>
      <label>Fee includes<input maxLength={1000} value={event.feeIncludesNote} onChange={(e) => update({ ...event, feeIncludesNote: e.target.value })} placeholder="Coffee, lunch, etc." /></label>
      {event.eventKind === "satellite" ? <label>Payout<select value={event.payoutNote} onChange={(e) => update({ ...event, payoutNote: e.target.value })}><option value="">Select a payout</option>{satellitePayoutOptions.map((option) => <option key={option}>{option}</option>)}</select></label> : <label className="setup-wide">Payout information<textarea maxLength={2000} value={event.payoutNote} onChange={(e) => update({ ...event, payoutNote: e.target.value })} /></label>}
    </div>
    {canPool ? <section><h3>Q Pools</h3>{event.qPools.map((pool, index) => <PoolEditor key={`${event.clientRowId}-${index}`} pool={pool} index={index} update={(value) => update({ ...event, qPools: event.qPools.map((item, poolIndex) => poolIndex === index ? value : item) })} remove={() => update({ ...event, qPools: event.qPools.filter((_, poolIndex) => poolIndex !== index) })} />)}<button type="button" className="secondary" disabled={event.qPools.length >= 2} onClick={() => update({ ...event, qPools: [...event.qPools, { poolTypeCode: "", entryFeeCents: 0, note: "" }] })}>Add Q Pool</button></section> : null}
    <button type="button" className="secondary danger-button" onClick={remove}>Remove event</button>
  </fieldset>;
}

export default function SetupClient({ actorId, tournamentId }: { actorId: string; tournamentId: string }) {
  const storageKey = `tournament-setup:${actorId}:${tournamentId}`, inFlight = useRef(false);
  const [payload, setPayload] = useState<SetupPayload | null>(null), [version, setVersion] = useState(0), [busy, setBusy] = useState(true), [pending, setPending] = useState<PendingSave | null>(null), [message, setMessage] = useState("Loading tournament setup…");
  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup`, { credentials: "same-origin", cache: "no-store" });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== "object") throw new Error("load");
    const result = data as Record<string, unknown>;
    if (!isSetupWorkspace(result.workspace) || !isSetupOfficialChoices(result.officialChoices)) throw new Error("shape");
    const current = result.workspace.current;
    setPayload(current ? { tournamentName: current.tournamentName, city: current.city, venue: current.venue, startsAt: current.startsAt.slice(0, 16), endsAt: current.endsAt.slice(0, 16), timezone: current.timezone, contactDetails: current.contactDetails, sanctioningFeeCents: current.sanctioningFeeCents, officials: current.officials, events: current.events.map(editableEvent) } : blankPayload(result.officialChoices));
    setVersion(current?.version ?? 0);
    setMessage(current ? `Saved setup version ${current.version} is loaded.` : "Enter the tournament details, then save the first version.");
  }, [tournamentId]);
  useEffect(() => { void (async () => { try { await load(); const recovered = readPending(storageKey); if (recovered) { setPending(recovered); setPayload(recovered.request.payload); setVersion(recovered.request.expectedVersion); setMessage("A previous save may be unresolved. Retry the exact saved version before editing."); } } catch { setMessage("Tournament setup is temporarily unavailable. Refresh to retry."); } finally { setBusy(false); } })(); }, [load, storageKey]);
  const counts = useMemo(() => payload ? payload.events.reduce((result, event) => ({ ...result, [event.eventKind]: (result[event.eventKind] ?? 0) + 1 }), {} as Record<string, number>) : {}, [payload]);
  function updateEvent(clientRowId: string, value: SetupEvent) { if (!payload || pending) return; setPayload({ ...payload, events: payload.events.map((event) => event.clientRowId === clientRowId ? value : event) }); }
  function add(kind: SetupEvent["eventKind"]) { if (!payload || pending || payload.events.length >= 32 || ((kind === "main" || kind === "consolation") && counts[kind])) return; setPayload({ ...payload, events: [...payload.events, defaultEvent(kind, payload.startsAt, payload.timezone)] }); }
  async function save(envelope: PendingSave) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setPending(envelope); setMessage("Saving the tournament setup…");
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope.request) }); const data: unknown = await response.json().catch(() => null);
      if (response.ok && isSavedSetup(data, envelope.request)) { clearPending(storageKey); setPending(null); await load(); setMessage(`Tournament setup version ${data.version} was saved.`); return; }
      if (response.status === 409) { clearPending(storageKey); setPending(null); await load(); setMessage("The setup was not changed. The latest saved version is shown."); return; }
      setMessage("The save is unresolved. Retry the exact saved version when the connection is available.");
    } catch { setMessage("The save is unresolved. Retry the exact saved version when the connection is available."); } finally { inFlight.current = false; setBusy(false); }
  }
  function startSave() { if (!payload || pending || busy) return; const request = { expectedVersion: version, payload, idempotencyKey: crypto.randomUUID() }; if (!isSetupSaveRequest(request)) { setMessage("Complete every required tournament and event field before saving."); return; } const envelope: PendingSave = { kind: "tournament-setup", request }; if (!storePending(storageKey, envelope)) { setMessage("This browser cannot safely retain the request for recovery."); return; } void save(envelope); }
  if (!payload) return <p className="auth-note" role="status">{message}</p>;
  return <section className="policy-settings setup-workspace"><h2>Tournament details</h2>
    <fieldset disabled={busy || !!pending}><div className="setup-grid">
      <label>Tournament name<input required maxLength={200} value={payload.tournamentName} onChange={(e) => setPayload({ ...payload, tournamentName: e.target.value })} /></label><label>City<input required maxLength={160} value={payload.city} onChange={(e) => setPayload({ ...payload, city: e.target.value })} /></label><label>Venue<input required maxLength={240} value={payload.venue} onChange={(e) => setPayload({ ...payload, venue: e.target.value })} /></label><label>Time zone<input required maxLength={128} value={payload.timezone} onChange={(e) => setPayload({ ...payload, timezone: e.target.value })} /></label><label>Starts<input required type="datetime-local" value={payload.startsAt} onChange={(e) => setPayload({ ...payload, startsAt: e.target.value })} /></label><label>Ends<input required type="datetime-local" value={payload.endsAt} onChange={(e) => setPayload({ ...payload, endsAt: e.target.value })} /></label><MoneyInput label="ACC Sanctioning Fee" value={payload.sanctioningFeeCents} onChange={(sanctioningFeeCents) => setPayload({ ...payload, sanctioningFeeCents })} /><label className="setup-wide">Director contact details<textarea maxLength={1000} value={payload.contactDetails} onChange={(e) => setPayload({ ...payload, contactDetails: e.target.value })} /></label>
    </div></fieldset>
    <div className="setup-heading"><div><h2>Tournament events</h2><p>Add every event belonging to this tournament. Team formats remain paper-scored for the October pilot.</p></div><div className="setup-actions"><button type="button" className="secondary" disabled={busy || !!pending || !!counts.main} onClick={() => add("main")}>Add Main Event</button><button type="button" className="secondary" disabled={busy || !!pending || !!counts.consolation} onClick={() => add("consolation")}>Add Consolation Event</button><button type="button" className="secondary" disabled={busy || !!pending || payload.events.length >= 32} onClick={() => add("satellite")}>Add Satellite Event</button></div></div>
    <fieldset disabled={busy || !!pending}><legend className="sr-only">Configured tournament events</legend>{payload.events.map((event, index) => <EventEditor key={event.clientRowId} event={event} number={index + 1} update={(value) => updateEvent(event.clientRowId, value)} remove={() => !pending && setPayload({ ...payload, events: payload.events.filter((candidate) => candidate.clientRowId !== event.clientRowId) })} />)}</fieldset>
    {payload.events.length === 0 ? <p className="auth-note">Add at least one event before saving.</p> : null}<p role="status" aria-live="polite" className={message.includes("unavailable") || message.includes("unresolved") || message.includes("Complete") ? "error-text" : "auth-note"}>{message}</p>
    {pending ? <button type="button" className="primary" disabled={busy} onClick={() => void save(pending)}>Retry exact saved request</button> : <button type="button" className="primary" disabled={busy || payload.events.length === 0} onClick={startSave}>Save Tournament Setup</button>}
  </section>;
}
