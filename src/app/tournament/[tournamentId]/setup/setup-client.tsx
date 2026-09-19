"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isRejectedSetup, isSavedSetup, isSetupOfficialChoices, isSetupSaveRequest, isSetupWorkspace,
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
import {
  isSanctioningFeeRateOverrideResult,
  type SanctioningFeeRateOverrideRequest,
} from "../../../../lib/api/sanctioning-fee";
import { formatUsdInput, parseUsdMinor } from "../../../../lib/money";
import {
  calculateSanctioningFeeRunningTotalCents,
  DEFAULT_CONSOLATION_SANCTIONING_FEE_RATE_CENTS,
  DEFAULT_MAIN_SANCTIONING_FEE_RATE_CENTS,
} from "../../../../lib/sanctioning-fee";
import { defaultTimeZoneForStateTerritory, tournamentStateTerritories, tournamentTimeZones } from "../../../../lib/tournament-timezones";
import SetupOfficialSummaries from "./setup-official-summaries";

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
  return { clientRowId: crypto.randomUUID(), eventKind: kind, displayName: eventLabels[kind], startsAt, timezone, styleCode: styleOptions[kind][0], formatCode: "standard_singles", gameCount: gameOptions[kind][0], entryFeeCents: 0, feeIncludesNote: "", payoutNote: "", qualificationNote: "", eligibilityNote: "", mugginsStatus: "unset", qPools: [], sidePools: [] };
}
function blankPayload(choices: SetupOfficialChoices): SetupPayload {
  const stateTerritory = "";
  const timezone = "America/New_York";
  const profileName = ["tournament participant", "tournament director", "primary director"].includes(choices.directorDisplayName.trim().toLowerCase()) ? "" : choices.directorDisplayName;
  return { tournamentName: "", city: "", venue: "", stateTerritory, startsAt: "", endsAt: "", timezone, tournamentDirectorPublicName: profileName, tournamentContactPhone: "", tournamentContactEmail: "", tournamentMailingAddress: "", mainSanctioningFeeRateCents: DEFAULT_MAIN_SANCTIONING_FEE_RATE_CENTS, consolationSanctioningFeeRateCents: DEFAULT_CONSOLATION_SANCTIONING_FEE_RATE_CENTS, mainSanctioningFeeOverrideReason: "", mainSanctioningFeeOverrideReference: "", consolationSanctioningFeeOverrideReason: "", consolationSanctioningFeeOverrideReference: "", officials: [{ profileId: choices.directorProfileId, role: "director" }, ...choices.coDirectorProfileIds.map((profileId) => ({ profileId, role: "co_director" as const }))], events: [] };
}
function readPending(key: string): PendingSave | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null"); return value && typeof value === "object" && (value as PendingSave).kind === "tournament-setup" && isSetupSaveRequest((value as PendingSave).request) ? value as PendingSave : null; } catch { return null; } }
function storePending(key: string, value: PendingSave | PendingActivation | PendingAmendment) { try { sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
function clearPending(key: string) { try { sessionStorage.removeItem(key); } catch { /* accepted server receipt remains authoritative */ } }
function readPendingActivation(key: string): PendingActivation | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null"); const request = value && typeof value === "object" ? (value as PendingActivation).request : null; return value && typeof value === "object" && (value as PendingActivation).kind === "tournament-activation" && request && typeof request === "object" && typeof request.setupRevisionId === "string" && Number.isSafeInteger(request.expectedVersion) && request.confirmed === true && typeof request.idempotencyKey === "string" ? value as PendingActivation : null; } catch { return null; } }
function readPendingAmendment(key: string): PendingAmendment | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null"); return value && typeof value === "object" && (value as PendingAmendment).kind === "tournament-setup-amendment" && isSetupAmendmentRequest((value as PendingAmendment).request) ? value as PendingAmendment : null; } catch { return null; } }
function editableEvent(event: SetupEvent & { sourceStatus?: string; qPools: Array<SetupPool & { slot?: number; sourceStatus?: string }>; sidePools: Array<SetupPool & { slot?: number; sourceStatus?: string }> }): SetupEvent {
  const { clientRowId, eventKind, displayName, startsAt, timezone, styleCode, formatCode, gameCount, entryFeeCents, feeIncludesNote, payoutNote, qualificationNote, eligibilityNote, mugginsStatus } = event;
  return { clientRowId, eventKind, displayName, startsAt: startsAt.slice(0, 16), timezone, styleCode, formatCode, gameCount, entryFeeCents, feeIncludesNote, payoutNote, qualificationNote, eligibilityNote, mugginsStatus, qPools: event.qPools.map(({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note }) => ({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note })), sidePools: event.sidePools.map(({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note }) => ({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note })) };
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
function RateInput({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(() => formatUsdInput(value));
  const parsed = parseUsdMinor(draft, { allowZero: true, maxMinor: 100_000 });
  const invalid = parsed === null;
  return <label>{label}<span className="money-input"><span aria-hidden="true">$</span><input
    aria-invalid={invalid} inputMode="decimal" placeholder="0.00" value={draft} disabled={disabled}
    onChange={(event) => {
      const next = event.target.value;
      setDraft(next);
      const nextParsed = parseUsdMinor(next, { allowZero: true, maxMinor: 100_000 });
      if (nextParsed !== null) onChange(nextParsed);
    }}
    onBlur={() => {
      if (invalid || parsed === null) { setDraft(formatUsdInput(value)); return; }
      onChange(parsed);
    }}
  /></span></label>;
}
function finalizationEventLine(event: SetupEvent) {
  return `${eventLabels[event.eventKind]}: ${event.displayName} - ${event.styleCode}`;
}
type ActivatedEvent = Extract<SetupActivationState, { status: "activated" }>["events"][number];
function activatedEventLine(event: ActivatedEvent) {
  const eventType = eventLabels[event.eventType as SetupEvent["eventKind"]] ?? "Tournament Event";
  const style = event.format === "canadian_doubles" ? "Canadian Doubles" : event.format === "doubles" ? "Doubles" : event.format === "standard_singles" ? "Standard" : event.format.replaceAll("_", " ");
  return `${eventType}: ${event.name} - ${style}`;
}
function SanctioningFeePanel({ payload, runningTotalCents, lastUpdatedAt, refreshing, busy, canAdjust, onRefresh, onApply }: { payload: SetupPayload; runningTotalCents: number; lastUpdatedAt: number | null; refreshing: boolean; busy: boolean; canAdjust: boolean; onRefresh: () => void; onApply: (request: SanctioningFeeRateOverrideRequest) => void }) {
  const [eventKind, setEventKind] = useState<"main" | "consolation" | null>(null);
  const [mainRateCents, setMainRateCents] = useState(payload.mainSanctioningFeeRateCents);
  const [consolationRateCents, setConsolationRateCents] = useState(payload.consolationSanctioningFeeRateCents);
  const [reason, setReason] = useState("");
  const displayedMain = eventKind === "main" ? mainRateCents : payload.mainSanctioningFeeRateCents;
  const displayedConsolation = eventKind === "consolation" ? consolationRateCents : payload.consolationSanctioningFeeRateCents;
  const editingRate = eventKind === "main" ? mainRateCents : consolationRateCents;
  const storedRate = eventKind === "main" ? payload.mainSanctioningFeeRateCents : payload.consolationSanctioningFeeRateCents;
  function begin(kind: "main" | "consolation") { if (!canAdjust || busy) return; setEventKind(kind); setReason(""); if (kind === "main") setMainRateCents(payload.mainSanctioningFeeRateCents); else setConsolationRateCents(payload.consolationSanctioningFeeRateCents); }
  function cancel() { setEventKind(null); setReason(""); }
  // Save is gated by disabled state rather than a silent early return. It used
  // to return with no message when the reason was blank OR when the rate was
  // unchanged, so a director who pressed Save got nothing and no explanation.
  const rateChanged = editingRate !== storedRate;
  const canSave = eventKind !== null && reason.trim().length > 0 && rateChanged;
  function save() { if (!eventKind || busy || !canSave) return; onApply({ eventKind, rateCents: editingRate, reason: reason.trim(), idempotencyKey: crypto.randomUUID() }); setEventKind(null); setReason(""); }
  return <section className="setup-subsection setup-wide sanctioning-fee-panel" aria-labelledby="sanctioning-fee-title"><h3 id="sanctioning-fee-title">ACC Sanctioning Fee Running Total: ${formatUsdInput(runningTotalCents)}</h3><p className="field-help">Calculated from the number of eligible Main and Consolation participants. It is not a player entry fee. Total is recorded as an official snapshot when each event starts.</p><div className="sanctioning-fee-status"><p className="field-help" aria-live="polite">Last updated: {lastUpdatedAt ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(lastUpdatedAt)) : "Loading…"}</p><button type="button" className="secondary" disabled={refreshing} onClick={onRefresh}>{refreshing ? "Refreshing total…" : "Refresh total"}</button></div><div className="setup-grid sanctioning-fee-rate-inputs"><div><RateInput key={`main-sanctioning-rate-${payload.mainSanctioningFeeRateCents}-${eventKind === "main"}`} label="Main rate per person" value={displayedMain} disabled={busy || eventKind !== "main"} onChange={setMainRateCents} /><button type="button" className="secondary" disabled={busy || !canAdjust || (eventKind !== null && eventKind !== "main") || (eventKind === "main" && !canSave)} onClick={() => eventKind === "main" ? save() : begin("main")}>{eventKind === "main" ? "Save Adjusted Main Rate" : "Adjust Main rate"}</button></div><div><RateInput key={`consolation-sanctioning-rate-${payload.consolationSanctioningFeeRateCents}-${eventKind === "consolation"}`} label="Consolation rate per person" value={displayedConsolation} disabled={busy || eventKind !== "consolation"} onChange={setConsolationRateCents} /><button type="button" className="secondary" disabled={busy || !canAdjust || (eventKind !== null && eventKind !== "consolation") || (eventKind === "consolation" && !canSave)} onClick={() => eventKind === "consolation" ? save() : begin("consolation")}>{eventKind === "consolation" ? "Save Adjusted Consolation Rate" : "Adjust Consolation rate"}</button></div></div>{eventKind ? <label><span className="required-label">Reason (<span className="required-field" aria-hidden="true">*</span>required)</span><span className="sr-only">required</span><input required aria-required="true" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}{eventKind ? <p className="field-help" aria-live="polite">{!rateChanged ? "Enter a rate different from the current one. Saving an unchanged rate would record nothing." : reason.trim().length === 0 ? "A reason is required. It is kept permanently on the ACC rate change record." : "Ready to save."}</p> : null}{eventKind ? <button type="button" className="secondary" disabled={busy} onClick={cancel}>Cancel rate change</button> : null}<p className="field-help">Only adjust with ACC Board approval. Before Start Play only. This creates an immutable, reasoned rate-change record; it does not change player receipts.</p></section>;
}
function PoolEditor({ pool, index, update, remove }: { pool: SetupPool; index: number; update: (value: SetupPool) => void; remove: () => void }) {
  return <fieldset className="setup-subsection"><legend>Q Pool {index + 1}</legend>
    <label>Pool type<select required value={pool.poolTypeCode} onChange={(event) => update({ ...pool, poolTypeCode: event.target.value })}><option value="">Select a Q Pool type</option>{qPoolOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
    <MoneyInput key={`pool-fee-${pool.entryFeeCents}`} label="Entry fee" value={pool.entryFeeCents} onChange={(entryFeeCents) => update({ ...pool, entryFeeCents: entryFeeCents ?? 0 })} />
    <label>Optional note<input maxLength={1000} value={pool.note} onChange={(event) => update({ ...pool, note: event.target.value })} /></label>
    <button type="button" className="secondary" onClick={remove}>Remove Q Pool</button>
  </fieldset>;
}
function SidePoolEditor({ pool, index, update, remove }: { pool: SetupPool; index: number; update: (value: SetupPool) => void; remove: () => void }) {
  return <fieldset className="setup-subsection"><legend>Side Pool {index + 1}</legend>
    <label>Side Pool type/name<input required maxLength={160} value={pool.poolTypeCode} onChange={(event) => update({ ...pool, poolTypeCode: event.target.value })} placeholder="Example: Early Bird Side Pool" /></label>
    <MoneyInput key={`side-pool-fee-${pool.entryFeeCents}`} label="Entry fee" value={pool.entryFeeCents} onChange={(entryFeeCents) => update({ ...pool, entryFeeCents: entryFeeCents ?? 0 })} />
    <label>Optional note<input maxLength={1000} value={pool.note} onChange={(event) => update({ ...pool, note: event.target.value })} /></label>
    <button type="button" className="secondary" onClick={remove}>Remove Side Pool</button>
  </fieldset>;
}
function EventEditor({ event, number, update, remove }: { event: SetupEvent; number: number; update: (value: SetupEvent) => void; remove: () => void }) {
  const canQPool = event.eventKind === "main" || event.eventKind === "consolation";
  const canSidePool = event.eventKind === "main" || event.eventKind === "consolation" || event.eventKind === "satellite";
  return <fieldset className="setup-event"><legend>{eventLabels[event.eventKind]} {number}</legend>
    <div className="setup-grid">
      <label>Event name<input required maxLength={200} value={event.displayName} onChange={(e) => update({ ...event, displayName: e.target.value })} /></label>
      <label>Style<select value={event.styleCode} onChange={(e) => update({ ...event, styleCode: e.target.value, formatCode: formatForStyle(e.target.value) })}>{styleOptions[event.eventKind].map((option) => <option key={option}>{option}</option>)}</select></label>
      <label>Games<select value={event.gameCount} onChange={(e) => update({ ...event, gameCount: Number(e.target.value) })}>{gameOptions[event.eventKind].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      <MoneyInput key={`event-fee-${event.entryFeeCents}`} label="Entry fee" value={event.entryFeeCents} onChange={(entryFeeCents) => update({ ...event, entryFeeCents: entryFeeCents ?? 0 })} />
      <label>Start date and time<input required type="datetime-local" value={event.startsAt} onChange={(e) => update({ ...event, startsAt: e.target.value })} /></label>
      <label>Fee includes<input aria-describedby={`${event.clientRowId}-fee-includes-help`} maxLength={1000} value={event.feeIncludesNote} onChange={(e) => update({ ...event, feeIncludesNote: e.target.value })} placeholder="Optional" /><span id={`${event.clientRowId}-fee-includes-help`} className="field-help">Coffee, donuts, lunch, etc.</span></label>
      {event.eventKind === "satellite" ? <label>Payout<select value={event.payoutNote} onChange={(e) => update({ ...event, payoutNote: e.target.value })}><option value="">Select a payout</option>{satellitePayoutOptions.map((option) => <option key={option}>{option}</option>)}</select><span className="field-help">Choose the advertised placement ratio. Actual payouts are recorded and reconciled after results.</span></label> : <label className="setup-wide">Payout information<textarea aria-describedby={`${event.clientRowId}-payout-help`} maxLength={2000} value={event.payoutNote} onChange={(e) => update({ ...event, payoutNote: e.target.value })} /><span id={`${event.clientRowId}-payout-help`} className="field-help">Optional player-facing event-prize plan. Example: “Paid to posted qualifying and playoff placements; final amounts depend on paid entries.” Q Pools and Side Pools are separate.</span></label>}
    </div>
    {canQPool ? <section><h3>Q Pools</h3><p className="field-help">Click Add Q Pool to enter its type, entry fee, and optional note. Main and Consolation events may each have up to two Q Pools.</p>{event.qPools.map((pool, index) => <PoolEditor key={`${event.clientRowId}-q-${index}`} pool={pool} index={index} update={(value) => update({ ...event, qPools: event.qPools.map((item, poolIndex) => poolIndex === index ? value : item) })} remove={() => update({ ...event, qPools: event.qPools.filter((_, poolIndex) => poolIndex !== index) })} />)}<button type="button" className="secondary" disabled={event.qPools.length >= 2} onClick={() => update({ ...event, qPools: [...event.qPools, { poolTypeCode: "", entryFeeCents: 0, note: "" }] })}>{event.qPools.length >= 2 ? "Add Q Pool limit reached" : "Add Q Pool"}</button></section> : null}
    {canSidePool ? <section><h3>Side Pools</h3><p className="field-help">Click Add Side Pool to enter its type, entry fee, and optional note. Each event may have up to six Side Pools.</p>{event.sidePools.map((pool, index) => <SidePoolEditor key={`${event.clientRowId}-side-${index}`} pool={pool} index={index} update={(value) => update({ ...event, sidePools: event.sidePools.map((item, poolIndex) => poolIndex === index ? value : item) })} remove={() => update({ ...event, sidePools: event.sidePools.filter((_, poolIndex) => poolIndex !== index) })} />)}<button type="button" className="secondary" disabled={event.sidePools.length >= 6} onClick={() => update({ ...event, sidePools: [...event.sidePools, { poolTypeCode: "", entryFeeCents: 0, note: "" }] })}>{event.sidePools.length >= 6 ? "Add Side Pool limit reached" : "Add Side Pool"}</button></section> : null}
    <button type="button" className="secondary danger-button" onClick={remove}>Remove event</button>
  </fieldset>;
}

export default function SetupClient({ actorId, tournamentId }: { actorId: string; tournamentId: string }) {
  const router = useRouter();
  const storageKey = `tournament-setup:${actorId}:${tournamentId}`, activationStorageKey = `tournament-activation:${actorId}:${tournamentId}`, amendmentStorageKey = `tournament-setup-amendment:${actorId}:${tournamentId}`, inFlight = useRef(false), sanctioningFeeRefreshInFlight = useRef(false);
  const [payload, setPayload] = useState<SetupPayload | null>(null), [savedFingerprint, setSavedFingerprint] = useState(""), [revisionId, setRevisionId] = useState<string | null>(null), [version, setVersion] = useState(0), [busy, setBusy] = useState(true), [pending, setPending] = useState<PendingSave | null>(null), [pendingActivation, setPendingActivation] = useState<PendingActivation | null>(null), [activationState, setActivationState] = useState<SetupActivationState>({ status: "not_activated" }), [message, setMessage] = useState("Loading tournament setup…");
  const [amendmentEvents, setAmendmentEvents] = useState<SetupEvent[]>([]), [pendingAmendment, setPendingAmendment] = useState<PendingAmendment | null>(null), [primaryDirectorName, setPrimaryDirectorName] = useState(""), [isPrimaryDirector, setIsPrimaryDirector] = useState(false), [publicDirectorDraft, setPublicDirectorDraft] = useState(""), [publicContactBusy, setPublicContactBusy] = useState(false), [activationStatusAvailable, setActivationStatusAvailable] = useState(true), [finalizationPromptOpen, setFinalizationPromptOpen] = useState(false), [sanctioningFee, setSanctioningFee] = useState<{ mainEligibleParticipantCount: number; consolationEligibleParticipantCount: number } | null>(null), [sanctioningFeeLastUpdatedAt, setSanctioningFeeLastUpdatedAt] = useState<number | null>(null), [sanctioningFeeRefreshing, setSanctioningFeeRefreshing] = useState(false), [rateOverrideBusy, setRateOverrideBusy] = useState(false), [teamUpgradeBusy, setTeamUpgradeBusy] = useState(false);
  const load = useCallback(async () => {
    const [response, activationResponse] = await Promise.all([
      fetch(`/api/v1/tournaments/${tournamentId}/setup`, { credentials: "same-origin", cache: "no-store" }),
      fetch(`/api/v1/tournaments/${tournamentId}/setup/activation`, { credentials: "same-origin", cache: "no-store" }),
    ]);
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== "object") throw new Error("load");
    const result = data as Record<string, unknown>;
    if (!isSetupWorkspace(result.workspace) || !isSetupOfficialChoices(result.officialChoices)) throw new Error("shape");
    const workspace = result.workspace;
    const current = workspace.current;
    const nextPayload = current ? { tournamentName: current.tournamentName, city: current.city, venue: current.venue, stateTerritory: current.stateTerritory, startsAt: current.startsAt.slice(0, 16), endsAt: current.endsAt.slice(0, 16), timezone: current.timezone, tournamentDirectorPublicName: current.tournamentDirectorPublicName, tournamentContactPhone: current.tournamentContactPhone, tournamentContactEmail: current.tournamentContactEmail, tournamentMailingAddress: current.tournamentMailingAddress, mainSanctioningFeeRateCents: current.mainSanctioningFeeRateCents, consolationSanctioningFeeRateCents: current.consolationSanctioningFeeRateCents, mainSanctioningFeeOverrideReason: current.mainSanctioningFeeOverrideReason, mainSanctioningFeeOverrideReference: current.mainSanctioningFeeOverrideReference, consolationSanctioningFeeOverrideReason: current.consolationSanctioningFeeOverrideReason, consolationSanctioningFeeOverrideReference: current.consolationSanctioningFeeOverrideReference, officials: current.officials, events: current.events.map(editableEvent) } : blankPayload(result.officialChoices);
    setPayload(nextPayload);
    setSanctioningFee({ mainEligibleParticipantCount: workspace.sanctioningFee.mainEligibleParticipantCount, consolationEligibleParticipantCount: workspace.sanctioningFee.consolationEligibleParticipantCount });
    setSanctioningFeeLastUpdatedAt(Date.now());
    setPrimaryDirectorName(result.officialChoices.directorDisplayName);
    setIsPrimaryDirector(result.officialChoices.directorProfileId === actorId);
    setPublicDirectorDraft(nextPayload.tournamentDirectorPublicName);
    setSavedFingerprint(current ? JSON.stringify(nextPayload) : "");
    setRevisionId(current?.revisionId ?? null);
    setVersion(current?.version ?? 0);
    let nextActivation: SetupActivationState = { status: "not_activated" };
    let nextActivationStatusAvailable = false;
    if (activationResponse.ok) {
      const activationData: unknown = await activationResponse.json().catch(() => null);
      if (isSetupActivationState(activationData)) {
        nextActivation = activationData;
        nextActivationStatusAvailable = true;
        setActivationState(activationData);
      }
    }
    setActivationStatusAvailable(nextActivationStatusAvailable);
    setMessage(!nextActivationStatusAvailable ? `Saved setup version ${current?.version ?? 0} is loaded. Event finalization status could not be checked; refresh before finalizing.` : nextActivation.status === "activated" ? `${nextActivation.eventCount} tournament event${nextActivation.eventCount === 1 ? "" : "s"} finalized for use.` : current ? `Saved setup version ${current.version} is loaded.` : "Enter the tournament details, then save the first version.");
    return nextActivation;
  }, [actorId, tournamentId]);
  useEffect(() => { void (async () => { try { const active = await load(); const recoveredActivation = readPendingActivation(activationStorageKey); if (active.status === "activated") clearPending(activationStorageKey); else if (recoveredActivation) { setPendingActivation(recoveredActivation); setMessage("A previous activation may be unresolved. Retry the exact request."); } const recovered = readPending(storageKey); if (recovered && active.status !== "activated") { setPending(recovered); setPayload(recovered.request.payload); setVersion(recovered.request.expectedVersion); setMessage("A previous save may be unresolved. Retry the exact saved version before editing."); } const recoveredAmendment = readPendingAmendment(amendmentStorageKey); if (recoveredAmendment && active.status === "activated") { setPendingAmendment(recoveredAmendment); setAmendmentEvents(recoveredAmendment.request.events); setMessage("A previous event addition may be unresolved. Retry the exact request before making another change."); } } catch { setMessage("Tournament setup is temporarily unavailable. Refresh to retry."); } finally { setBusy(false); } })(); }, [activationStorageKey, amendmentStorageKey, load, storageKey]);
  const refreshSanctioningFee = useCallback(async () => {
    if (sanctioningFeeRefreshInFlight.current) return;
    sanctioningFeeRefreshInFlight.current = true;
    setSanctioningFeeRefreshing(true);
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup`, { credentials: "same-origin", cache: "no-store" });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok || !data || typeof data !== "object") throw new Error("sanctioning-fee");
      const workspace = (data as Record<string, unknown>).workspace;
      if (!isSetupWorkspace(workspace)) throw new Error("sanctioning-fee-shape");
      setSanctioningFee({ mainEligibleParticipantCount: workspace.sanctioningFee.mainEligibleParticipantCount, consolationEligibleParticipantCount: workspace.sanctioningFee.consolationEligibleParticipantCount });
      setSanctioningFeeLastUpdatedAt(Date.now());
    } catch {
      // Keep the last confirmed server value visible if a background refresh
      // cannot reach the setup reader. This path must never overwrite the
      // director's in-progress form fields or surface a noisy retry error.
    } finally {
      sanctioningFeeRefreshInFlight.current = false;
      setSanctioningFeeRefreshing(false);
    }
  }, [tournamentId]);
  const counts = useMemo(() => payload ? payload.events.reduce((result, event) => ({ ...result, [event.eventKind]: (result[event.eventKind] ?? 0) + 1 }), {} as Record<string, number>) : {}, [payload]);
  const activated = activationState.status === "activated";
  const dirty = !!payload && JSON.stringify(payload) !== savedFingerprint;
  const sanctioningFeeRunningTotalCents = payload ? calculateSanctioningFeeRunningTotalCents({ mainEligibleParticipantCount: sanctioningFee?.mainEligibleParticipantCount ?? 0, consolationEligibleParticipantCount: sanctioningFee?.consolationEligibleParticipantCount ?? 0 }, { mainRateCents: payload.mainSanctioningFeeRateCents, consolationRateCents: payload.consolationSanctioningFeeRateCents }) : 0;
  function updateEvent(clientRowId: string, value: SetupEvent) { if (!payload || pending || activated) return; setPayload({ ...payload, events: payload.events.map((event) => event.clientRowId === clientRowId ? value : event) }); }
  function add(kind: SetupEvent["eventKind"]) { if (!payload || pending || activated || payload.events.length >= 32 || ((kind === "main" || kind === "consolation") && counts[kind])) return; setPayload({ ...payload, events: [...payload.events, defaultEvent(kind, payload.startsAt, payload.timezone)] }); }
  async function save(envelope: PendingSave) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setPending(envelope); setMessage("Saving the tournament setup…");
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope.request) }); const data: unknown = await response.json().catch(() => null);
      if (response.ok && isSavedSetup(data, envelope.request)) { clearPending(storageKey); setPending(null); await load(); setMessage(`Tournament setup version ${data.version} was saved.`); return; }
      if (response.status === 409 && isRejectedSetup(data)) { clearPending(storageKey); setPending(null); await load(); setMessage("The setup was not changed. The latest saved version is shown."); return; }
      setMessage("The save is unresolved. Retry the exact saved version when the connection is available.");
    } catch { setMessage("The save is unresolved. Retry the exact saved version when the connection is available."); } finally { inFlight.current = false; setBusy(false); }
  }
  function startSave() { if (!payload || pending || busy) return; const request = { expectedVersion: version, payload, idempotencyKey: crypto.randomUUID() }; if (!isSetupSaveRequest(request)) { setMessage("Complete every required tournament and event field before saving."); return; } const envelope: PendingSave = { kind: "tournament-setup", request }; if (!storePending(storageKey, envelope)) { setMessage("This browser cannot safely retain the request for recovery."); return; } void save(envelope); }
  async function activate(envelope: PendingActivation) {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setPendingActivation(envelope); setMessage("Activating the tournament events…");
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup/activation`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope.request) }); const data: unknown = await response.json().catch(() => null);
      if (response.ok && isSetupActivationResult(data, envelope.request)) { clearPending(activationStorageKey); setPendingActivation(null); setMessage(`${data.eventCount} event${data.eventCount === 1 ? "" : "s"} finalized. Registration is now open; opening the QR and registration-link workspace…`); router.push(`/tournament/${tournamentId}/registration`); return; }
      if (response.status === 409 && isRejectedSetupActivation(data)) { clearPending(activationStorageKey); setPendingActivation(null); await load(); setMessage(data.code === "already_activated" ? "All events are already finalized and registration is open." : data.code === "missing_tournament_contact" ? "Tournament contact phone and email are required before events can be finalized and registration opened." : data.code === "missing_state_territory" ? "Select the tournament State/Territory, save the draft, and then finalize the events." : "Events were not finalized. Review the saved draft and try again."); return; }
      setMessage("Finalization is unresolved. Retry the exact request when the connection is available.");
    } catch { setMessage("Finalization is unresolved. Retry the exact request when the connection is available."); } finally { inFlight.current = false; setBusy(false); }
  }
  function startActivation() { if (!revisionId || version < 1 || dirty || busy || pending || pendingActivation || counts.main !== 1) return; setFinalizationPromptOpen(true); }
  function confirmActivation() { if (!revisionId || version < 1 || dirty || busy || pending || pendingActivation || counts.main !== 1) return; setFinalizationPromptOpen(false); const envelope: PendingActivation = { kind: "tournament-activation", request: { setupRevisionId: revisionId, expectedVersion: version, confirmed: true, idempotencyKey: crypto.randomUUID() } }; if (!storePending(activationStorageKey, envelope)) { setMessage("This browser cannot safely retain the finalization request for recovery."); return; } void activate(envelope); }
  async function overrideSanctioningFeeRate(request: SanctioningFeeRateOverrideRequest) {
    if (rateOverrideBusy || busy) return;
    setRateOverrideBusy(true); setMessage("Recording the ACC Sanctioning Fee rate change…");
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/sanctioning-fee-rate`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && isSanctioningFeeRateOverrideResult(data, request)) { await load(); setMessage("ACC Sanctioning Fee rate change recorded."); return; }
      setMessage("The rate change was not applied. Confirm the event has not started and try again.");
    } catch { setMessage("The rate change could not be confirmed. Refresh before trying again."); } finally { setRateOverrideBusy(false); }
  }
  async function enableTeamScoring(eventId: string) {
    if (teamUpgradeBusy || busy) return;
    setTeamUpgradeBusy(true); setMessage("Enabling digital and paper team scoring for this unstarted event…");
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/team-scoring/enable`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, idempotencyKey: crypto.randomUUID() }) });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && data && typeof data === "object" && (data as Record<string, unknown>).status === "supported_team_scoring_enabled") { await load(); setMessage("Digital and Paper team scoring is enabled for this event."); return; }
      setMessage("Team scoring was not changed. The event must be an unstarted Traditional or Canadian Doubles event with no enrollment, seats, schedule, or scores.");
    } catch { setMessage("Team scoring could not be confirmed. Refresh before trying again."); } finally { setTeamUpgradeBusy(false); }
  }
  async function correctPublicDirectorName() {
    if (!isPrimaryDirector || publicContactBusy || !publicDirectorDraft.trim()) return;
    setPublicContactBusy(true); setMessage("Updating the public Tournament Director name…");
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/public-contact`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify({ directorName: publicDirectorDraft.trim(), idempotencyKey: crypto.randomUUID() }) });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && data && typeof data === "object" && (data as Record<string, unknown>).status === "public_contact_corrected") { await load(); setMessage("The public Tournament Director name was updated."); return; }
      setMessage("The public Tournament Director name was not updated. Confirm it is a real name and try again.");
    } catch { setMessage("The public Tournament Director name could not be confirmed. Refresh before trying again."); }
    finally { setPublicContactBusy(false); }
  }
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
  return <section className="policy-settings setup-workspace"><h2>Tournament details</h2><p className="auth-note">Primary director: {primaryDirectorName}</p>
    <fieldset disabled={busy || !!pending || activated}><div className="setup-grid">
      <label>Tournament name<input required maxLength={200} value={payload.tournamentName} onChange={(e) => setPayload({ ...payload, tournamentName: e.target.value })} /></label>
      <label>City<input required maxLength={160} value={payload.city} onChange={(e) => setPayload({ ...payload, city: e.target.value })} /></label>
      <label>Venue<input required maxLength={240} value={payload.venue} onChange={(e) => setPayload({ ...payload, venue: e.target.value })} /></label>
      <label>State/Territory<select required value={payload.stateTerritory} onChange={(e) => { const stateTerritory = e.target.value; setPayload({ ...payload, stateTerritory, timezone: defaultTimeZoneForStateTerritory(stateTerritory) }); }}><option value="">Select State/Territory</option>{tournamentStateTerritories.map((stateTerritory) => <option key={stateTerritory} value={stateTerritory}>{stateTerritory}</option>)}</select></label>
      <label>Time zone<select required value={payload.timezone} onChange={(e) => setPayload({ ...payload, timezone: e.target.value })}>{tournamentTimeZones.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select><span className="field-help">The selected zone handles daylight saving time where applicable.</span></label>
      <label>Starts<input required type="datetime-local" value={payload.startsAt} onChange={(e) => setPayload({ ...payload, startsAt: e.target.value })} /></label>
      <label>Ends<input required type="datetime-local" value={payload.endsAt} onChange={(e) => setPayload({ ...payload, endsAt: e.target.value })} /></label>
      <label className="setup-wide">Tournament Director name (shown to players)<input required maxLength={160} autoComplete="name" value={payload.tournamentDirectorPublicName} onChange={(e) => setPayload({ ...payload, tournamentDirectorPublicName: e.target.value })} /><span className="field-help">Use the name players should see for this tournament. It is separate from private account information.</span></label>
      <label><span className="required-label">Tournament contact phone (<span className="required-field" aria-hidden="true">*</span>required)</span><span className="sr-only">required</span><input required aria-required="true" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} value={payload.tournamentContactPhone} onChange={(e) => setPayload({ ...payload, tournamentContactPhone: e.target.value })} /></label>
      <label><span className="required-label">Tournament contact email (<span className="required-field" aria-hidden="true">*</span>required)</span><span className="sr-only">required</span><input required aria-required="true" type="email" autoComplete="email" maxLength={320} value={payload.tournamentContactEmail} onChange={(e) => setPayload({ ...payload, tournamentContactEmail: e.target.value })} /></label>
      <label className="setup-wide">Tournament mailing address (optional)<span id="tournament-mailing-address-help" className="field-help">*Note: This address will be visible to players.</span><textarea aria-describedby="tournament-mailing-address-help" maxLength={500} value={payload.tournamentMailingAddress} onChange={(e) => setPayload({ ...payload, tournamentMailingAddress: e.target.value })} /></label>
    </div></fieldset>
    <SanctioningFeePanel payload={payload} runningTotalCents={sanctioningFeeRunningTotalCents} lastUpdatedAt={sanctioningFeeLastUpdatedAt} refreshing={sanctioningFeeRefreshing} busy={busy || !!pending || rateOverrideBusy} canAdjust={!!revisionId && !pending} onRefresh={() => void refreshSanctioningFee()} onApply={overrideSanctioningFeeRate} />
    <SetupOfficialSummaries tournamentId={tournamentId} canManage={isPrimaryDirector} />
    {!activated ? <><div className="setup-heading"><div><h2>Tournament events</h2><p>Click Add Main Event to enter its event name, fees, date and time, included items, and Q Pools. Add Consolation or Satellite events when needed. Two-person Traditional Doubles and Canadian Doubles support shared Digital or Paper team scorecards.</p></div><div className="setup-actions"><button type="button" className="secondary" disabled={busy || !!pending || !!counts.main} onClick={() => add("main")}>Add Main Event</button><button type="button" className="secondary" disabled={busy || !!pending || !!counts.consolation} onClick={() => add("consolation")}>Add Consolation Event</button><button type="button" className="secondary" disabled={busy || !!pending || payload.events.length >= 32} onClick={() => add("satellite")}>Add Satellite Event</button></div></div>
      <fieldset disabled={busy || !!pending}><legend className="sr-only">Configured tournament events</legend>{payload.events.map((event, index) => <EventEditor key={event.clientRowId} event={event} number={index + 1} update={(value) => updateEvent(event.clientRowId, value)} remove={() => !pending && setPayload({ ...payload, events: payload.events.filter((candidate) => candidate.clientRowId !== event.clientRowId) })} />)}</fieldset>
      {payload.events.length === 0 ? <p className="auth-note">Add at least one event before saving.</p> : null}</> : null}<p role="status" aria-live="polite" className={message.includes("unavailable") || message.includes("unresolved") || message.includes("Complete") ? "error-text" : "auth-note"}>{message}</p>
    {!activationStatusAvailable ? <button type="button" className="secondary" disabled={busy} onClick={() => void load()}>Refresh finalization status</button> : null}
    {!activated && finalizationPromptOpen ? <section className="setup-amendment" role="alertdialog" aria-modal="true" aria-labelledby="finalize-events-title"><h2 id="finalize-events-title">Open registration for all current events?</h2><p>Please confirm you intend to open registration for these events. Event details will no longer be editable.</p><ul>{payload.events.map((event) => <li key={event.clientRowId}>{finalizationEventLine(event)}</li>)}</ul><div className="setup-actions"><button type="button" className="secondary" onClick={() => setFinalizationPromptOpen(false)}>Cancel</button><button type="button" className="primary" onClick={confirmActivation}>Yes, Finalize &amp; Open Registration</button></div></section> : null}
    {activated ? <>
      <section className="setup-activation-summary"><h2>All events are finalized; registration is open</h2><p>These events are available for roster enrollment, seating, schedules, financials, and later Start Play. Finalizing opens registration; it does not start play, close registration, assign seats, charge anyone, or publish results.</p><section className="setup-finalized-tournament-summary" aria-label="Saved tournament details"><h3>Saved tournament details</h3><dl><div><dt>Location</dt><dd>{payload.city} · {payload.venue}</dd></div><div><dt>State/Territory</dt><dd>{payload.stateTerritory || "Not recorded in this historic setup"}</dd></div><div><dt>Time zone</dt><dd>{tournamentTimeZones.find((zone) => zone.value === payload.timezone)?.label ?? payload.timezone}</dd></div><div><dt>Schedule</dt><dd>{payload.startsAt.replace("T", " ")} to {payload.endsAt.replace("T", " ")}</dd></div></dl></section><ul>{activationState.events.map((event) => <li key={event.eventId}><strong>{activatedEventLine(event)}</strong> — {event.gameCount} games, {event.scoringMethod === "digital" ? "digital and paper scoring" : "paper scoring"}{event.scoringMethod === "manual" && ["doubles", "canadian_doubles"].includes(event.format) ? <button type="button" className="secondary" disabled={busy || teamUpgradeBusy} onClick={() => void enableTeamScoring(event.eventId)}>Enable Digital and Paper Team Scoring</button> : null}</li>)}</ul><a className="primary button-link registration-primary" href={`/tournament/${tournamentId}/registration`}>Create or manage registration QR code and URL</a></section>
      {isPrimaryDirector ? <section className="setup-amendment"><h2>Public registration contact</h2><p>Correct the name shown to players without reopening registration or changing finalized events.</p><label>Tournament Director name (shown to players)<input required maxLength={160} autoComplete="name" value={publicDirectorDraft} onChange={(event) => setPublicDirectorDraft(event.target.value)} /></label><button type="button" className="secondary" disabled={publicContactBusy || !publicDirectorDraft.trim() || publicDirectorDraft.trim() === payload.tournamentDirectorPublicName.trim()} onClick={() => void correctPublicDirectorName()}>{publicContactBusy ? "Updating…" : "Update public Director name"}</button></section> : null}
      <section className="setup-post-finalization"><h2>Post-finalization event administration</h2><p>Use only when necessary after registration opens. These tools do not start play, rewrite active event details, or erase records.</p><div className="setup-post-finalization-actions"><a className="secondary button-link" href={`/tournament/${tournamentId}/side-pools`}>Set Up Side Pools</a><a className="secondary button-link" href={`/tournament/${tournamentId}/event-changes`}>Exceptional Event Changes</a></div><section className="setup-amendment"><div className="setup-heading"><div><h3>Add a later event</h3><p>Add a Consolation or Satellite event without changing any active event.</p></div><div className="setup-actions"><button type="button" className="secondary" disabled={busy || !!pendingAmendment || activationState.events.some((event) => event.eventType === "consolation") || amendmentEvents.some((event) => event.eventKind === "consolation")} onClick={() => addAmendmentEvent("consolation")}>Add Consolation Event</button><button type="button" className="secondary" disabled={busy || !!pendingAmendment || activationState.events.length + amendmentEvents.length >= 32} onClick={() => addAmendmentEvent("satellite")}>Add Satellite Event</button></div></div><fieldset disabled={busy || !!pendingAmendment}><legend className="sr-only">New tournament events</legend>{amendmentEvents.map((event, index) => <EventEditor key={event.clientRowId} event={event} number={activationState.events.length + index + 1} update={(value) => setAmendmentEvents((events) => events.map((candidate) => candidate.clientRowId === value.clientRowId ? value : candidate))} remove={() => setAmendmentEvents((events) => events.filter((candidate) => candidate.clientRowId !== event.clientRowId))} />)}</fieldset>{pendingAmendment ? <button type="button" className="primary" disabled={busy} onClick={() => void amend(pendingAmendment)}>Retry Exact Event Addition</button> : amendmentEvents.length > 0 ? <button type="button" className="primary" disabled={busy || amendmentEvents.length === 0} onClick={startAmendment}>Add New Tournament Events</button> : null}</section></section>
    </> : pending ? <button type="button" className="primary" disabled={busy} onClick={() => void save(pending)}>Retry exact saved request</button> : <div className="setup-actions"><button type="button" className="primary" disabled={busy || payload.events.length === 0 || !dirty} onClick={startSave}>Save All Events Draft</button>{revisionId && counts.main === 1 ? pendingActivation ? <button type="button" className="primary" disabled={busy} onClick={() => void activate(pendingActivation)}>Retry Finalize & Open Registration</button> : <button type="button" className="primary" disabled={busy || dirty || !activationStatusAvailable} onClick={startActivation}>Finalize All Events / Open Registration</button> : null}</div>}
  </section>;
}
