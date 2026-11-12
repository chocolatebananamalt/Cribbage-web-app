"use client";
import { canonicalGuidedEvents, mainRemovalBlocked } from "../../../../lib/setup-guided-event-order";
import { MainConsolationChoice } from "../../../../components/main-consolation-choice";
import { TournamentPhoneInput } from "../../../../components/tournament-phone-input";
import { isSetupEventLinksWorkspace, isLinkedSetupSaveResult, isLinkedSetupActivationResult, isRejectedLinkedSetup, linkedSetupRejectionMessage, validateSetupEventLinks, type SetupEventLinkChoice, type SetupEventLinksSnapshot } from "../../../../lib/api/setup-event-links";
import { parsePendingLinkedSetup, clearVerifiedLinkedRecovery, clearRejectedLinkedRecovery, linkedSnapshotMatches, type PendingLinkedSetup } from "../../../../lib/setup-linked-recovery";

import "./setup-save-status.css";
import "./setup-event-actions.css";
import { formatSetupSavedAt } from "../../../../lib/setup-save-status";
import { supportsSetupPrizeSchedule } from "../../../../lib/results/prize-schedule-setup";
import { SetupSidePoolEditor } from "../../../../components/setup-side-pool-editor";
import { SetupPresetPayoutChoice } from "../../../../components/setup-preset-payout-choice";
import { nextSidePoolDefaultName } from "../../../../lib/api/side-pool-setup-selection";
import { isLegacySideRequestUnbound, isSidePoolRequestConflict } from "../../../../lib/api/side-pool-setup-capability";
import { isSetupSaveWithUnchangedLegacySides } from "../../../../lib/setup-legacy-side-validation";
import { readEventPrizeDeclarationPins } from "../../../../lib/setup-event-declaration-readiness";
import { setAppRecoveryItem,assertRecoveryWriteAllowed } from "../../../../lib/recovery-write-coordinator";
import {assertRecoveryStorageOwner} from "../../../../lib/auth/recovery-owner";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isRejectedSetup, isSavedSetup, isSetupOfficialChoices, isSetupSaveRequest, isLegacySideSetupSaveRequest, isLegacySideSetupEvent, isSetupWorkspace, isRetainedSetupSaveRequest, minimumPaidEntryCents, setupRejectionMessage,
  type SetupEvent, type SetupOfficialChoices, type SetupPayload, type SetupPool, type SetupSaveRequest,
} from "../../../../lib/api/setup";
import {
  isRejectedSetupActivation,
  isSetupActivationRequest,
  isSetupActivationResult,
  isSetupActivationState,
  type SetupActivationRequest,
  type DeclarationActivationPin,
  type SetupActivationState,
} from "../../../../lib/api/setup-activation";
import {
  isRejectedSetupAmendment,
  isSetupAmendmentRequest, isRetainedSetupAmendmentRequest,
  isSetupAmendmentResult,
  type SetupAmendmentRequest,
} from "../../../../lib/api/setup-amendment";
import {
  isSanctioningFeeRateOverrideResult,
  sanctioningFeeRateRejectionMessage,
  type SanctioningFeeRateOverrideRequest,
} from "../../../../lib/api/sanctioning-fee";
import { formatUsdInput, parseUsdMinor } from "../../../../lib/money";
import {
  calculateSanctioningFeeRunningTotalCents,
  DEFAULT_CONSOLATION_SANCTIONING_FEE_RATE_CENTS,
  DEFAULT_MAIN_SANCTIONING_FEE_RATE_CENTS,
} from "../../../../lib/sanctioning-fee";
import { defaultTimeZoneForStateTerritory, isTournamentStateTerritory, tournamentStateTerritories, tournamentTimeZones } from "../../../../lib/tournament-timezones";
import PrizeScheduleClient from "./prize-schedule-client";
import EventPrizeDeclarationClient from "./event-prize-declaration-client";
import SetupOfficialSummaries from "./setup-official-summaries";
import { creationDateInputValue } from "../../../../lib/setup-dates";
import { TournamentDateFields } from "../../../../components/tournament-date-fields";
import { isTournamentCreated } from "../../../../lib/api/director-administration";
import { setupFinancialTermsMatch } from "../../../../lib/setup-save-verification";
import { acceptedSetupKey, parseAcceptedSetupReceipt, clearVerifiedSetupRecovery } from "../../../../lib/setup-save-recovery";

import { EventPlayoffParametersEditor } from "../../../../components/event-playoff-parameters-editor";
import { newEventPlayoffParametersDraftV1,resolveEventSeriesDraftV1 } from "../../../../lib/playoffs/event-playoff-parameters-v1";
import { isEventSettingsDraftSavedV3, type EventSettingsChoiceV3 } from "../../../../lib/api/event-settings-setup-v3";
import { readEventSettingsOperationRecordV3, type EventSettingsWorkspaceV3 } from "../../../../lib/api/event-settings-handlers-v3";
import { eventSettingsActivationBlockedV3, parsePendingEventSettingsSetupV3, serializePendingEventSettingsSetupV3, buildPendingEventSettingsSetupV3, choicesFromEventSettingsWorkspaceV3, eventSettingsChoicesForPayloadV3, eventSettingsWorkspaceCoversSetupV3, eventSettingsReadbackMatchesV3, canonicalEventSettingsClientV3, type PendingEventSettingsSetupV3 } from "../../../../lib/setup-event-settings-recovery-v3";
import {readEventPrizeWorkspaceV1,type EventPrizeWorkspaceV1} from "../../../../lib/api/event-prize-workspace-v1";
import {readEventPrizeAcceptedReplyV1,eventPrizeSettingsRequestHashV1,type EventPrizePlanChoiceV1} from "../../../../lib/api/event-prize-settings-v1";
import {newPlayoffPrizePlanDraftV2,inspectPlayoffPrizePlanV2} from "../../../../lib/playoffs/playoff-prize-plan-v2";
import {EventPrizeRuleReviewV1} from "../../../../components/event-prize-rule-review-v1";
import {eventPrizeRuleContextReviewsMatchV1,type EventPrizeRuleContextReadyReviewsV1} from "../../../../lib/api/event-prize-rule-context-v1";
import {buildPendingEventPrizeSetupV1,serializePendingEventPrizeSetupV1,parsePendingEventPrizeSetupV1,prizeWorkspaceCoversSetupV1,choicesFromPrizeWorkspaceV1,prizeChoicesForPayloadV1,eventPrizeReadbackMatchesV1,assessEventPrizePendingResolutionV1,serializePendingPrizeActivationV1,parsePendingPrizeActivationV1,type PendingPrizeActivationV1,type EventPrizePendingResolutionV1,type PendingEventPrizeSetupV1} from "../../../../lib/setup-event-prize-recovery-v1";

import {readEventPrizeActivationSourceV1,buildEventPrizeActivationV1,serializeEventPrizeActivationV1,eventPrizeActivationRequestHashV1,readEventPrizeActivationRecordV1,type EventPrizeActivationRecordV1} from "../../../../lib/api/event-prize-activation-v1";
type PendingSave = (PendingEventPrizeSetupV1 & { accepted?: {revisionId:string;version:number} }) | (PendingEventSettingsSetupV3 & { accepted?: {revisionId:string;version:number} }) | { kind: "tournament-setup"; request: SetupSaveRequest; stage?: "details" | "all"; accepted?: {revisionId:string;version:number} } | (PendingLinkedSetup & { accepted?: {revisionId:string;version:number} });
type PendingActivation = PendingPrizeActivationV1 | { kind: "tournament-activation"; request: SetupActivationRequest } | { kind: "tournament-activation-linked-v1"; request: SetupActivationRequest; associationHash: string };
type PendingAmendment = { kind: "tournament-setup-amendment"; request: SetupAmendmentRequest };
const legacySideUnboundMessage = "This earlier save cannot verify its original Side Pool choices. Your pending request is retained. Do not retry or clear app data; contact support for recovery.";
const sideRequestConflictMessage = "This saved request no longer matches the original Side Pool choices. Your pending request is retained. Do not retry or clear app data; contact support for recovery.";
const sideRecoveryUnknownMessage = "This saved request's recovery warning cannot be verified. Your pending request is retained. Do not retry or clear app data; contact support for recovery.";
type SideRecoveryBlockReason = "unbound" | "conflict" | "unknown";
function sideRecoveryBlockMessage(reason: SideRecoveryBlockReason) { return reason === "unbound" ? legacySideUnboundMessage : reason === "conflict" ? sideRequestConflictMessage : sideRecoveryUnknownMessage; }
function legacySideUnboundKey(key: string, operationId: string) { return `${key}:side-unbound:${operationId}`; }
function retainSideRecoveryBlock(key: string, operationId: string, reason: "unbound" | "conflict") {
  try { setAppRecoveryItem(sessionStorage, legacySideUnboundKey(key, operationId), JSON.stringify({kind:"side-setup-blocked",operationId,reason})); return true; } catch { return false; }
}
function readSideRecoveryBlock(key: string, operationId: string): SideRecoveryBlockReason | null {
  try { const raw=sessionStorage.getItem(legacySideUnboundKey(key, operationId)); if(raw===null)return null; const value: unknown=JSON.parse(raw); if(!value||typeof value!=="object"||Array.isArray(value))return "unknown"; const item=value as Record<string,unknown>; if(item.kind==="legacy-side-unbound"&&item.operationId===operationId)return "unbound"; if(item.kind==="side-setup-blocked"&&item.operationId===operationId&&(item.reason==="unbound"||item.reason==="conflict")&&Object.keys(item).length===3)return item.reason; return "unknown"; } catch { return "unknown"; }
}
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
  return { clientRowId: crypto.randomUUID(), eventKind: kind, displayName: eventLabels[kind], startsAt, timezone, styleCode: styleOptions[kind][0], formatCode: "standard_singles", gameCount: gameOptions[kind][0], entryFeeCents: NaN, freeEntry: false, feeIncludesNote: "", payoutNote: "", qualificationNote: "", eligibilityNote: "", mugginsStatus: "unset", qPools: [], sidePools: [] };
}
function splitPersonName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 ? { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) ?? "" } : { firstName: parts[0] ?? "", lastName: "" };
}
function venueProjection(venueName: string, venueStreet: string, venuePostalCode: string) { return `${venueName.trim()} — ${venueStreet.trim()} · ${venuePostalCode.trim()}`; }
function directorProjection(firstName: string, lastName: string) { return `${firstName.trim()} ${lastName.trim()}`; }
type CreationSeed = { name: string; plannedDate: string };
function blankPayload(choices: SetupOfficialChoices, creationSeed?: CreationSeed): SetupPayload {
  const stateTerritory = "";
  const timezone = "America/New_York";
  const profileName = ["tournament participant", "tournament director", "primary director"].includes(choices.directorDisplayName.trim().toLowerCase()) ? "" : choices.directorDisplayName;
  const director = splitPersonName(profileName);
  return { tournamentName: creationSeed?.name ?? "", city: "", venue: "", venueName: "", venueStreet: "", venuePostalCode: "", stateTerritory, startsAt: creationSeed ? creationDateInputValue(creationSeed.plannedDate) : "", endsAt: "", timezone, tournamentDirectorPublicName: profileName, tournamentDirectorFirstName: director.firstName, tournamentDirectorLastName: director.lastName, tournamentContactPhone: "", tournamentContactEmail: "", tournamentMailingAddress: "", mainSanctioningFeeRateCents: DEFAULT_MAIN_SANCTIONING_FEE_RATE_CENTS, consolationSanctioningFeeRateCents: DEFAULT_CONSOLATION_SANCTIONING_FEE_RATE_CENTS, mainSanctioningFeeOverrideReason: "", mainSanctioningFeeOverrideReference: "", consolationSanctioningFeeOverrideReason: "", consolationSanctioningFeeOverrideReference: "", officials: [{ profileId: choices.directorProfileId, role: "director" }, ...choices.coDirectorProfileIds.map((profileId) => ({ profileId, role: "co_director" as const }))], events: [] };
}

function tournamentDetailIssues(payload: SetupPayload) {
  const issues: string[] = [];
  const requiredText: Array<[string, string]> = [
    ["Tournament name", payload.tournamentName],
    ["Venue name", payload.venueName],
    ["Venue street address", payload.venueStreet],
    ["Venue city", payload.city],
    ["Venue ZIP", payload.venuePostalCode],
    ["Tournament Director first name", payload.tournamentDirectorFirstName],
    ["Tournament Director last name", payload.tournamentDirectorLastName],
  ];
  for (const [label, value] of requiredText) if (!value.trim()) issues.push(label);
  if (payload.venue.length > 240) issues.push("Venue name and street (240 characters combined)");
  const publicName = directorProjection(payload.tournamentDirectorFirstName, payload.tournamentDirectorLastName);
  if (["tournament participant", "tournament director", "primary director"].includes(publicName.toLowerCase()) && !issues.includes("Tournament Director first name")) issues.push("Tournament Director name");
  if (!isTournamentStateTerritory(payload.stateTerritory)) issues.push("State/Territory");
  if (!payload.timezone.trim()) issues.push("Time zone");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(payload.startsAt)) issues.push("Start date and time");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(payload.endsAt)) issues.push("Number of days");
  if (payload.tournamentContactPhone.trim() && (payload.tournamentContactPhone.match(/\d/g)?.length ?? 0) < 7) issues.push("Tournament contact phone");
  if (payload.tournamentContactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.tournamentContactEmail.trim())) issues.push("Tournament contact email");
  return issues;
}
function readPending(key: string, actorId?: string, tournamentId?: string): PendingSave | null {
  try {
    const raw = sessionStorage.getItem(key); const prize=actorId&&tournamentId?parsePendingEventPrizeSetupV1(raw,actorId,tournamentId):null;if(prize)return prize; const settings = actorId && tournamentId ? parsePendingEventSettingsSetupV3(raw,actorId,tournamentId) : null; if (settings) return settings; const linked = parsePendingLinkedSetup(raw); if (linked) return linked; const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object" || (value as PendingSave).kind !== "tournament-setup" || !isRetainedSetupSaveRequest((value as PendingSave).request)) return null;
    const saved = {...value} as PendingSave; delete saved.accepted;
    let accepted: PendingSave["accepted"] | null = null;
    try { accepted=parseAcceptedSetupReceipt(sessionStorage.getItem(acceptedSetupKey(key,saved.request.idempotencyKey)),saved.request); } catch { /* keep the original exact request even if acknowledgement storage cannot be read */ }
    if (accepted) return {...saved,accepted};
    return saved;
  } catch { return null; }
}
function storePending(key: string, value: PendingSave | PendingActivation | PendingAmendment) { try { if(value.kind === "tournament-prize-activation-v1"){const raw=serializePendingPrizeActivationV1(value);if(!raw||sessionStorage.getItem(key)!==null)return false;setAppRecoveryItem(sessionStorage,key,raw);return sessionStorage.getItem(key)===raw;} if(value.kind === "tournament-event-prize-v1"){const raw=serializePendingEventPrizeSetupV1(value);if(!raw||sessionStorage.getItem(key)!==null)return false;setAppRecoveryItem(sessionStorage,key,raw);return sessionStorage.getItem(key)===raw;} if(value.kind === "tournament-event-settings-v3") { const raw=serializePendingEventSettingsSetupV3(value); if(!raw||sessionStorage.getItem(key)!==null)return false;setAppRecoveryItem(sessionStorage,key,raw);return sessionStorage.getItem(key)===raw; } const text=JSON.stringify(value); setAppRecoveryItem(sessionStorage, key, text); return sessionStorage.getItem(key)===text; } catch { return false; } }
function clearPending(key: string) { try { sessionStorage.removeItem(key); } catch { /* accepted server receipt remains authoritative */ } }
function readCreationSeed(key: string, tournamentId: string): CreationSeed | undefined { try { const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null"); return isTournamentCreated(value) && value.tournamentId === tournamentId ? { name: value.tournamentName, plannedDate: value.tournamentDate } : undefined; } catch { return undefined; } }
function clearCreationSeed(key: string) { try { sessionStorage.removeItem(key); } catch { /* accepted setup receipt remains authoritative */ } }
function readPendingActivation(key: string,actorId?:string,tournamentId?:string): PendingActivation | null { try { const prize=actorId&&tournamentId?parsePendingPrizeActivationV1(sessionStorage.getItem(key),actorId,tournamentId):null;if(prize)return prize;const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null"); return value && typeof value === "object" && !Array.isArray(value) && isSetupActivationRequest((value as PendingActivation).request) && ((Object.keys(value).sort().join(',')==='kind,request' && (value as PendingActivation).kind === "tournament-activation") || (Object.keys(value).sort().join(',')==='associationHash,kind,request' && (value as PendingActivation).kind === "tournament-activation-linked-v1" && typeof (value as {associationHash:unknown}).associationHash === "string" && /^[a-f0-9]{64}$/.test((value as {associationHash:string}).associationHash))) ? value as PendingActivation : null; } catch { return null; } }
function readPendingAmendment(key: string): PendingAmendment | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null"); return value && typeof value === "object" && (value as PendingAmendment).kind === "tournament-setup-amendment" && isRetainedSetupAmendmentRequest((value as PendingAmendment).request) ? value as PendingAmendment : null; } catch { return null; } }
function editableEvent(event: SetupEvent & { sourceStatus?: string; qPools: Array<SetupPool & { slot?: number; sourceStatus?: string }>; sidePools: Array<SetupPool & { slot?: number; sourceStatus?: string }> }): SetupEvent {
  const { clientRowId, eventKind, displayName, startsAt, timezone, styleCode, formatCode, gameCount, entryFeeCents, freeEntry, feeIncludesNote, payoutNote, qualificationNote, eligibilityNote, mugginsStatus } = event;
  return { clientRowId, eventKind, displayName, startsAt: startsAt.slice(0, 16), timezone, styleCode, formatCode, gameCount, entryFeeCents, ...(freeEntry === undefined ? {} : {freeEntry}), feeIncludesNote, payoutNote, qualificationNote, eligibilityNote, mugginsStatus, qPools: event.qPools.map(({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note }) => ({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note })), sidePools: event.sidePools.map(({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note, payoutType }) => ({ poolTypeCode, entryFeeCents: poolEntryFeeCents, note, ...(payoutType ? { payoutType } : {}) })) };
}

function MoneyInput({ label, value, onChange, minimum = 0, step = 1 }: { label: string; value: number | null; onChange: (value: number | null) => void; minimum?: number; step?: number }) {
  const errorId = useId();
  const [state, setState] = useState(() => ({source:value,text:formatUsdInput(value)}));
  const draft = state.text;
  if (!Object.is(state.source, value)) {
    // Preserve equivalent in-progress text, but reset when a different pool or
    // authoritative saved value replaces this editor. NaN is local invalid state.
    const equivalent = parseUsdMinor(draft, {allowZero:true,maxMinor:100_000_000}) === value;
    setState({source:value,text:Number.isSafeInteger(value) && !equivalent ? formatUsdInput(value) : draft});
  }
  const parsed = draft === "" ? null : parseUsdMinor(draft, { allowZero: true, maxMinor: 100_000_000 });
  const invalid = parsed === null || parsed < minimum || parsed % step !== 0;
  return <label>{label}<span className="money-input"><span aria-hidden="true">$</span><input
    required aria-required="true" aria-label={label} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} inputMode="decimal" placeholder="0.00" value={draft}
    onChange={(event) => { const next = event.target.value; setState({source:value,text:next}); onChange(parseUsdMinor(next, {allowZero:true,maxMinor:100_000_000})); }}
    onBlur={() => {
      if (parsed !== null) setState({source:value,text:formatUsdInput(parsed)});
    }}
  /></span>{invalid && <span id={errorId} className="error-text">{`Enter an amount of at least $${formatUsdInput(minimum)}, in $${formatUsdInput(step)} increments.`}</span>}</label>;
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
  return `${eventLabels[event.eventKind]}: ${event.displayName} - ${event.styleCode}; base entry $${formatUsdInput(event.entryFeeCents)}; Q-Pools ${event.qPools.map((p,i)=>`${i+1}: ${p.poolTypeCode} $${formatUsdInput(p.entryFeeCents)}`).join(", ") || "none"}; Side Pools ${event.sidePools.map((p,i)=>`${i+1}: ${p.poolTypeCode} $${formatUsdInput(p.entryFeeCents)}${p.payoutType ? ` (${p.payoutType.replace("graduated-1-in-", "Graduated 1-in-")})` : " (historical type not recorded)"}`).join(", ") || "none"}`;
}
type ActivatedEvent = Extract<SetupActivationState, { status: "activated" }>["events"][number];
function activatedEventLine(event: ActivatedEvent) {
  const eventType = eventLabels[event.eventType as SetupEvent["eventKind"]] ?? "Tournament Event";
  const style = event.format === "canadian_doubles" ? "Canadian Doubles" : event.format === "doubles" ? "Doubles" : event.format === "standard_singles" ? "Standard" : event.format.replaceAll("_", " ");
  return `${eventType}: ${event.name} - ${style}`;
}
// The rates shown here are the tournament's EFFECTIVE rates, read from the
// setup workspace, not from the setup payload. They are two different things on
// a tournament whose setup has never been saved: there is no payload to read
// from, but a rate override still applies and the running total still uses it.
function SanctioningFeePanel({ eligibleCounts, mainRateCents: storedMainRateCents, consolationRateCents: storedConsolationRateCents, runningTotalCents, lastUpdatedAt, refreshing, busy, canAdjust, unavailableReason, onRefresh, onApply }: { eligibleCounts: { main: number; consolation: number } | null; mainRateCents: number; consolationRateCents: number; runningTotalCents: number; lastUpdatedAt: number | null; refreshing: boolean; busy: boolean; canAdjust: boolean; unavailableReason: string | null; onRefresh: () => void; onApply: (request: SanctioningFeeRateOverrideRequest) => void }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const editorId = useId();
  const editorToggle = useRef<HTMLButtonElement>(null);
  const [eventKind, setEventKind] = useState<"main" | "consolation" | null>(null);
  const [mainRateCents, setMainRateCents] = useState(storedMainRateCents);
  const [consolationRateCents, setConsolationRateCents] = useState(storedConsolationRateCents);
  const [reason, setReason] = useState("");
  const displayedMain = eventKind === "main" ? mainRateCents : storedMainRateCents;
  const displayedConsolation = eventKind === "consolation" ? consolationRateCents : storedConsolationRateCents;
  const editingRate = eventKind === "main" ? mainRateCents : consolationRateCents;
  const storedRate = eventKind === "main" ? storedMainRateCents : storedConsolationRateCents;
  function begin(kind: "main" | "consolation") { if (!canAdjust || busy) return; setEventKind(kind); setReason(""); if (kind === "main") setMainRateCents(storedMainRateCents); else setConsolationRateCents(storedConsolationRateCents); }
  function cancel() { setEventKind(null); setReason(""); setEditorOpen(false); editorToggle.current?.focus(); }
  // Save is gated by disabled state rather than a silent early return. It used
  // to return with no message when the reason was blank OR when the rate was
  // unchanged, so a director who pressed Save got nothing and no explanation.
  const rateChanged = editingRate !== storedRate;
  const canSave = eventKind !== null && reason.trim().length > 0 && rateChanged;
  const reasonField = <label className="sanctioning-rate-reason"><span className="required-label">Reason (<span className="required-field" aria-hidden="true">*</span>required)</span><input required aria-required="true" aria-invalid={reason.trim().length === 0} aria-describedby={`${editorId}-reason-help`} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>;
  function save() { if (!eventKind || busy || !canSave) return; onApply({ eventKind, rateCents: editingRate, reason: reason.trim(), idempotencyKey: crypto.randomUUID() }); setEventKind(null); setReason(""); }
  return <section className="setup-subsection setup-wide sanctioning-fee-panel" aria-labelledby="sanctioning-fee-title"><h3 id="sanctioning-fee-title">ACC Sanctioning Fee Running Total: ${formatUsdInput(runningTotalCents)}</h3><p className="field-help">Calculated from the number of eligible Main and Consolation participants. It is not a player entry fee. Total is recorded as an official snapshot when each event starts.</p><div className="sanctioning-fee-status"><p className="field-help" aria-live="polite">Last updated: {lastUpdatedAt ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(lastUpdatedAt)) : "Loading…"}</p><button type="button" className="secondary" disabled={refreshing} onClick={onRefresh}>{refreshing ? "Refreshing total…" : "Refresh total"}</button></div><p className="field-help">{eligibleCounts ? `Currently eligible participants: Main ${eligibleCounts.main}; Consolation ${eligibleCounts.consolation}.` : "Eligible participant counts are unavailable."} These are sanctioning-eligible counts, not total registrations. The running total is an estimate before Start Play.</p><button type="button" className="secondary" ref={editorToggle} aria-expanded={editorOpen} aria-controls={editorId} disabled={busy} onClick={() => editorOpen ? cancel() : setEditorOpen(true)}>Adjust ACC sanctioning fee</button>{unavailableReason ? <p className="auth-note" role="status">{unavailableReason}</p> : null}<div id={editorId} hidden={!editorOpen}><div className="setup-grid sanctioning-fee-rate-inputs"><div><RateInput key={`main-sanctioning-rate-${storedMainRateCents}-${eventKind === "main"}`} label="Main Rate per Person" value={displayedMain} disabled={busy || eventKind !== "main"} onChange={setMainRateCents} />{eventKind === "main" ? reasonField : null}{eventKind === "consolation" ? <p id={`${editorId}-main-locked`} className="field-help">Finish or cancel the Consolation rate change first.</p> : null}<button type="button" className="secondary" aria-describedby={eventKind === "consolation" ? `${editorId}-main-locked` : undefined} disabled={busy || !canAdjust || (eventKind !== null && eventKind !== "main") || (eventKind === "main" && !canSave)} onClick={() => eventKind === "main" ? save() : begin("main")}>{eventKind === "main" ? "Save Adjusted Main Rate" : "Adjust Main rate"}</button></div><div><RateInput key={`consolation-sanctioning-rate-${storedConsolationRateCents}-${eventKind === "consolation"}`} label="Consolation Rate per Person" value={displayedConsolation} disabled={busy || eventKind !== "consolation"} onChange={setConsolationRateCents} />{eventKind === "consolation" ? reasonField : null}{eventKind === "main" ? <p id={`${editorId}-consolation-locked`} className="field-help">Finish or cancel the Main rate change first.</p> : null}<button type="button" className="secondary" aria-describedby={eventKind === "main" ? `${editorId}-consolation-locked` : undefined} disabled={busy || !canAdjust || (eventKind !== null && eventKind !== "consolation") || (eventKind === "consolation" && !canSave)} onClick={() => eventKind === "consolation" ? save() : begin("consolation")}>{eventKind === "consolation" ? "Save Adjusted Consolation Rate" : "Adjust Consolation rate"}</button></div></div>{eventKind ? <p id={`${editorId}-reason-help`} className="field-help" aria-live="polite">{!rateChanged ? "Enter a rate different from the current one. Saving an unchanged rate would record nothing." : reason.trim().length === 0 ? "A reason is required. It is kept permanently on the ACC rate change record." : "Ready to save."}</p> : null}{eventKind ? <button type="button" className="secondary" disabled={busy} onClick={cancel}>Cancel rate change</button> : null}<p className="field-help">Only adjust with ACC Board approval. Before Start Play only. This creates an immutable, reasoned rate-change record; it does not change player receipts.</p>{!eventKind ? <button type="button" className="secondary" disabled={busy} onClick={cancel}>Cancel adjustments</button> : null}</div></section>;
}
function PoolEditor({ pool, index, update, remove, editorIdentity, validationIdentity, onValidityChange }: { pool: SetupPool; index: number; update: (value: SetupPool) => void; remove: () => void; editorIdentity: string; validationIdentity: string; onValidityChange?: (valid: boolean) => void }) {
  return <fieldset className="setup-subsection"><legend>Q-Pool {index + 1}</legend>
    <SetupPresetPayoutChoice kind="q" value={pool.poolTypeCode} options={qPoolOptions} editorIdentity={editorIdentity} validationIdentity={validationIdentity} onValidityChange={onValidityChange} onChange={poolTypeCode => update({ ...pool, poolTypeCode })}/>
    <MoneyInput minimum={500} step={500} label="Entry Fee" value={pool.entryFeeCents} onChange={(entryFeeCents) => update({ ...pool, entryFeeCents: entryFeeCents ?? NaN })} />
    <label>Optional Note<input maxLength={1000} value={pool.note} onChange={(event) => update({ ...pool, note: event.target.value })} /></label>
    <button type="button" className="secondary" onClick={remove}>Remove Q-Pool</button>
  </fieldset>;
}
function LegacySidePoolEditor({ pool, index, update, remove }: { pool: SetupPool; index: number; update: (value: SetupPool) => void; remove: () => void }) {
  return <fieldset className="setup-subsection"><legend>Side Pool {index + 1}</legend>
    <label>Side Pool Type/Name<input required maxLength={160} value={pool.poolTypeCode} onChange={(event) => update({ ...pool, poolTypeCode: event.target.value })} placeholder="Example: Early Bird Side Pool" /></label>
    <MoneyInput minimum={500} step={500} label="Entry Fee" value={pool.entryFeeCents} onChange={(entryFeeCents) => update({ ...pool, entryFeeCents: entryFeeCents ?? NaN })} />
    <label>Optional Note<input maxLength={1000} value={pool.note} onChange={(event) => update({ ...pool, note: event.target.value })} /></label>
    <button type="button" className="secondary" onClick={remove}>Remove Side Pool</button>
  </fieldset>;
}
function EventEditor({ event, number, update, remove, sidePoolTypesReady, removeBlocked = false, onPayoutValidityChange, playoffChoice, onPlayoffChoiceChange, playoffEnabled = false,prizeChoice,onPrizeChoiceChange,prizeEnabled=false }: { prizeChoice?:EventPrizePlanChoiceV1;onPrizeChoiceChange?:(choice:EventPrizePlanChoiceV1,expected?:Extract<EventPrizePlanChoiceV1,{mode:'proposed_v2'}>['draft']|'preserve_historical')=>void;prizeEnabled?:boolean; playoffChoice?: EventSettingsChoiceV3; onPlayoffChoiceChange?: (choice: EventSettingsChoiceV3) => void; playoffEnabled?: boolean; event: SetupEvent; number: number; update: (value: SetupEvent) => void; remove: () => void; sidePoolTypesReady: boolean; removeBlocked?: boolean; onPayoutValidityChange?: (key: string, valid: boolean) => void }) {
  const canQPool = event.eventKind === "main" || event.eventKind === "consolation";
  const canSidePool = event.eventKind === "main" || event.eventKind === "consolation" || event.eventKind === "satellite";
  const [qRows, setQRows] = useState(() => ({ next: event.qPools.length, ids: event.qPools.map((_, i) => i) }));
  const [sideRows, setSideRows] = useState(() => ({ next: event.sidePools.length, ids: event.sidePools.map((_, i) => i) }));
  if (qRows.ids.length !== event.qPools.length) setQRows({ next: qRows.next + event.qPools.length, ids: event.qPools.map((_, i) => qRows.next + i) });
  if (sideRows.ids.length !== event.sidePools.length) {
    // An authoritative external load changed the row count. Ordinary edits,
    // adds and removals below retain their local identities, not index/name keys.
    setSideRows({ next: sideRows.next + event.sidePools.length, ids: event.sidePools.map((_, i) => sideRows.next + i) });
  }
  function removeSidePool(index: number) {
    setSideRows(previous => ({ ...previous, ids: previous.ids.filter((_, i) => i !== index) }));
    update({ ...event, sidePools: event.sidePools.filter((_, i) => i !== index) });
  }
  function removeQPool(index: number) {
    setQRows(previous => ({ ...previous, ids: previous.ids.filter((_, i) => i !== index) }));
    update({ ...event, qPools: event.qPools.filter((_, i) => i !== index) });
  }
  function addQPool() {
    if (event.qPools.length >= 2) return;
    setQRows(previous => ({ next: previous.next + 1, ids: [...previous.ids, previous.next] }));
    update({ ...event, qPools: [...event.qPools, { poolTypeCode: "", entryFeeCents: NaN, note: "" }] });
  }
  function addSidePool() {
    if (event.sidePools.length >= 6) return;
    setSideRows(previous => ({ next: previous.next + 1, ids: [...previous.ids, previous.next] }));
    update({ ...event, sidePools: [...event.sidePools, { poolTypeCode: sidePoolTypesReady ? nextSidePoolDefaultName(event.sidePools.map(pool => pool.poolTypeCode)) : "", entryFeeCents: NaN, note: "" }] });
  }
  return <fieldset className="setup-event"><legend>{eventLabels[event.eventKind]} {number}</legend>
    <div className="setup-grid">
      <label>Event Name<input required maxLength={200} value={event.displayName} onChange={(e) => update({ ...event, displayName: e.target.value })} /></label>
      <label>Style<select value={event.styleCode} onChange={(e) => update({ ...event, styleCode: e.target.value, formatCode: formatForStyle(e.target.value) })}>{styleOptions[event.eventKind].map((option) => <option key={option}>{option}</option>)}</select></label>
      <label>Games<select value={event.gameCount} onChange={(e) => update({ ...event, gameCount: Number(e.target.value) })}>{gameOptions[event.eventKind].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      <label>Entry Type<select aria-label="Entry Type" value={event.freeEntry === true ? "free" : "paid"} onChange={(e) => update({...event, freeEntry:e.target.value === "free", entryFeeCents:e.target.value === "free" ? 0 : NaN})}><option value="paid">Paid event</option><option value="free">Free event</option></select></label>
      {event.freeEntry === true ? <p className="field-help">No entry fee is charged. Sanctioning and other costs still require funding; this choice does not waive them or create a receipt.</p> : <MoneyInput minimum={minimumPaidEntryCents(event.eventKind)} label="Entry Fee" value={event.entryFeeCents} onChange={(entryFeeCents) => update({ ...event, entryFeeCents: entryFeeCents ?? NaN })} />}
      <label>Start Date and Time<input required type="datetime-local" value={event.startsAt} onChange={(e) => update({ ...event, startsAt: e.target.value })} /></label>
      <label>Fee Includes<input aria-describedby={`${event.clientRowId}-fee-includes-help`} maxLength={1000} value={event.feeIncludesNote} onChange={(e) => update({ ...event, feeIncludesNote: e.target.value })} placeholder="Optional" /><span id={`${event.clientRowId}-fee-includes-help`} className="field-help">Coffee, donuts, lunch, etc.</span></label>
      {canQPool && playoffEnabled && <div className="setup-wide">{prizeEnabled ? playoffChoice?.mode==='configured'&&prizeChoice?.mode==='proposed_v2' ? <EventPlayoffParametersEditor setupSaveConnected draft={playoffChoice.draft} onDraftChange={draft=>onPlayoffChoiceChange?.({eventClientRowId:event.clientRowId,mode:'configured',draft})} context={null} prizePlan={{draft:prizeChoice.draft,field:{status:'unknown',qualifierCount:null,firstRoundLoserPlaces:null,entryFeeMinor:Number.isSafeInteger(event.entryFeeCents)?event.entryFeeCents:null},onDraftChange:(draft,expected)=>onPrizeChoiceChange?.({eventClientRowId:event.clientRowId,mode:'proposed_v2',draft},expected)}}/> : <section aria-label="Playoff"><h4>Playoff</h4><p>Historical settings are preserved. Choose the new Playoff settings before finalizing with the new policy. Saving a draft does not calculate prizes or move money.</p><button type="button" className="secondary" onClick={()=>{if(playoffChoice?.mode!=='configured')onPlayoffChoiceChange?.({eventClientRowId:event.clientRowId,mode:'configured',draft:newEventPlayoffParametersDraftV1(event.eventKind as 'main'|'consolation')});if(prizeChoice?.mode!=='proposed_v2')onPrizeChoiceChange?.({eventClientRowId:event.clientRowId,mode:'proposed_v2',draft:newPlayoffPrizePlanDraftV2()},'preserve_historical');}}>Use New Playoff Settings</button></section> : <><p className="field-help">Versioned Playoff settings draft. Rule context has not yet been verified; saving does not authorize activation. Existing prize declarations remain required.</p>{playoffChoice?.mode==='configured'?<EventPlayoffParametersEditor setupSaveConnected draft={playoffChoice.draft} onDraftChange={draft=>onPlayoffChoiceChange?.({eventClientRowId:event.clientRowId,mode:'configured',draft})} context={null}/>:<><p>Historical Playoff settings and declaration checks are preserved.</p><button type="button" className="secondary" onClick={()=>onPlayoffChoiceChange?.({eventClientRowId:event.clientRowId,mode:'configured',draft:newEventPlayoffParametersDraftV1(event.eventKind as 'main'|'consolation')})}>Configure Playoff Settings</button></>}</>}</div>}
      {event.eventKind === "satellite" ? <div><SetupPresetPayoutChoice kind="satellite" value={event.payoutNote} options={satellitePayoutOptions} editorIdentity={`${event.clientRowId}:satellite:payout`} validationIdentity={`${event.clientRowId}:satellite:payout`} onValidityChange={valid => onPayoutValidityChange?.(`${event.clientRowId}:satellite:payout`,valid)} onChange={payoutNote => update({ ...event, payoutNote })}/><span className="field-help">Choose the advertised placement ratio. Actual payouts are recorded and reconciled after results.</span></div> : <label className="setup-wide">Payout Information<textarea aria-describedby={`${event.clientRowId}-payout-help`} maxLength={2000} value={event.payoutNote} onChange={(e) => update({ ...event, payoutNote: e.target.value })} /><span id={`${event.clientRowId}-payout-help`} className="field-help">Optional player-facing event-prize plan. Example: “Paid to posted qualifying and playoff placements; final amounts depend on paid entries.” Q-Pools and Side Pools are separate.</span></label>}
    </div>
    {canQPool ? <section><h3>Q-Pools</h3><p className="field-help">Click Add Q-Pool to enter its type, entry fee, and optional note. Main and Consolation events may each have up to two Q-Pools.</p>{event.qPools.map((pool, index) => <PoolEditor key={`${event.clientRowId}-q-row-${qRows.ids[index]}`} editorIdentity={`${event.clientRowId}:q-row:${qRows.ids[index]}`} validationIdentity={`${event.clientRowId}:q:${index}`} onValidityChange={valid => onPayoutValidityChange?.(`${event.clientRowId}:q:${index}`,valid)} pool={pool} index={index} update={(value) => update({ ...event, qPools: event.qPools.map((item, poolIndex) => poolIndex === index ? value : item) })} remove={() => removeQPool(index)} />)}<button type="button" className="secondary" disabled={event.qPools.length >= 2} onClick={addQPool}>{event.qPools.length >= 2 ? "Add Q-Pool limit reached" : "Add Q-Pool"}</button></section> : null}
    {canSidePool ? <section><h3>Side Pools</h3><p className="field-help">Click Add Side Pool to enter its type, entry fee, and optional note. Each event may have up to six Side Pools.</p>{event.sidePools.map((pool, index) => sidePoolTypesReady ? <SetupSidePoolEditor key={`${event.clientRowId}-side-row-${sideRows.ids[index]}`} editorIdentity={`${event.clientRowId}:side-row:${sideRows.ids[index]}`} pool={pool} index={index} supportedFormat={event.formatCode === "standard_singles"} onValidityChange={valid => onPayoutValidityChange?.(`${event.clientRowId}:side:${index}`,valid)} update={(value) => update({ ...event, sidePools: event.sidePools.map((item, poolIndex) => poolIndex === index ? value : item) })} remove={() => removeSidePool(index)} feeInput={<MoneyInput minimum={500} step={500} label="Entry Fee" value={pool.entryFeeCents} onChange={(entryFeeCents) => update({ ...event, sidePools: event.sidePools.map((item, poolIndex) => poolIndex === index ? { ...pool, entryFeeCents: entryFeeCents ?? NaN } : item) })} />} /> : <LegacySidePoolEditor key={`${event.clientRowId}-side-row-${sideRows.ids[index]}`} pool={pool} index={index} update={(value) => update({ ...event, sidePools: event.sidePools.map((item, poolIndex) => poolIndex === index ? value : item) })} remove={() => removeSidePool(index)} />)}<button type="button" className="secondary" disabled={event.sidePools.length >= 6} onClick={addSidePool}>{event.sidePools.length >= 6 ? "Add Side Pool limit reached" : "Add Side Pool"}</button></section> : null}
    <button type="button" className="secondary danger-button" disabled={removeBlocked} onClick={remove}>Remove event</button>
  </fieldset>;
}

function EventAddActions({ position, counts, count, disabled, linkedReady, add }: { position: "above" | "below"; counts: Record<string, number>; count: number; disabled: boolean; linkedReady: boolean; add: (kind: SetupEvent["eventKind"]) => void }) {
  return <div className={`setup-actions setup-event-add-actions setup-event-add-actions-${position}`} role="group" aria-label={`Add events ${position} configured events`}>
    {position === "above" || !counts.main || linkedReady ? <button type="button" className="secondary" disabled={disabled || (!linkedReady && !!counts.main) || count >= 32} onClick={() => add("main")}>Add Main Event</button> : null}
    {position === "above" || !counts.consolation || linkedReady ? <button type="button" className="secondary" disabled={disabled || (!linkedReady && !!counts.consolation) || count >= 32} onClick={() => add("consolation")}>Add Consolation Event</button> : null}
    <button type="button" className="secondary" disabled={disabled || count >= 32} onClick={() => add("satellite")}>Add Satellite Event</button>
  </div>;
}

export default function SetupClient({ actorId, tournamentId, registrationLinkManagementEnabled, creationSeed, eventSettingsV3Enabled = false, eventPrizeSettingsV1Enabled = false }: { eventPrizeSettingsV1Enabled?:boolean; eventSettingsV3Enabled?: boolean; actorId: string; tournamentId: string; registrationLinkManagementEnabled?: boolean; creationSeed?: CreationSeed }) {
  const router = useRouter();
  const settingsOwner = useMemo(() => ({actorId,tournamentId,eventSettingsV3Enabled,eventPrizeSettingsV1Enabled}),[actorId,tournamentId,eventSettingsV3Enabled,eventPrizeSettingsV1Enabled]);
  const settingsOwnerRef = useRef<typeof settingsOwner|null>(null);
  const loadSequence = useRef(0);
  const [settingsState,setSettingsState]=useState<{owner:typeof settingsOwner;workspace:EventSettingsWorkspaceV3;choices:Record<string,EventSettingsChoiceV3>;saved:string}|null>(null);
  const [settingsRecoveryBlocked,setSettingsRecoveryBlocked]=useState(false);
  const settingsReady=eventSettingsV3Enabled&&settingsState?.owner===settingsOwner;
  const [prizeState,setPrizeState]=useState<{owner:typeof settingsOwner;workspace:EventPrizeWorkspaceV1;settings:Record<string,EventSettingsChoiceV3>;prizes:Record<string,EventPrizePlanChoiceV1>;saved:string}|null>(null);
  const prizeReady=eventPrizeSettingsV1Enabled&&prizeState?.owner===settingsOwner;
  const [prizeResolution,setPrizeResolution]=useState<{owner:typeof settingsOwner;raw:string;proof:EventPrizePendingResolutionV1;confirm:boolean}|null>(null);
  const [prizeRuleReady,setPrizeRuleReady]=useState<{owner:typeof settingsOwner;pin:string;ready:boolean;reviews:EventPrizeRuleContextReadyReviewsV1|null}|null>(null);
  const prizeRuleEvidenceRef=useRef<{owner:typeof settingsOwner;pin:string;reviews:EventPrizeRuleContextReadyReviewsV1|null}|null>(null);
  const [rejectedPrizeActivation,setRejectedPrizeActivation]=useState<{owner:typeof settingsOwner;raw:string;record:EventPrizeActivationRecordV1;confirm:boolean}|null>(null);

  const storageKey = `tournament-setup:${actorId}:${tournamentId}`, creationSeedStorageKey = `tournament-creation-seed:${actorId}:${tournamentId}`, activationStorageKey = `tournament-activation:${actorId}:${tournamentId}`, amendmentStorageKey = `tournament-setup-amendment:${actorId}:${tournamentId}`, inFlight = useRef(false), sanctioningFeeRefreshInFlight = useRef(false);
  useLayoutEffect(() => { settingsOwnerRef.current=settingsOwner;return()=>{if(settingsOwnerRef.current===settingsOwner){settingsOwnerRef.current=null;inFlight.current=false;}}; },[settingsOwner]);
  const [payload, setPayload] = useState<SetupPayload | null>(null), [savedFingerprint, setSavedFingerprint] = useState(""), [revisionId, setRevisionId] = useState<string | null>(null), [version, setVersion] = useState(0), [busy, setBusy] = useState(true), [pending, setPending] = useState<PendingSave | null>(null), [pendingActivation, setPendingActivation] = useState<PendingActivation | null>(null), [activationState, setActivationState] = useState<SetupActivationState>({ status: "not_activated" }), [message, setMessage] = useState("Loading tournament setup…");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pendingYesMainIds, setPendingYesMainIds] = useState<string[]>([]);
  const payoutValidityRef = useRef<Record<string, false>>({});
  const [invalidPayouts, setInvalidPayouts] = useState<Record<string, false>>({});
  const onPayoutValidityChange = useCallback((key: string, valid: boolean) => {
    const current = payoutValidityRef.current;
    if ((valid && !Object.hasOwn(current, key)) || (!valid && current[key] === false)) return;
    const next = { ...current };
    if (valid) delete next[key]; else next[key] = false;
    payoutValidityRef.current = next; setInvalidPayouts(next);
  }, []);
  const amendmentPayoutValidityRef = useRef<Record<string, false>>({});
  const [invalidAmendmentPayouts, setInvalidAmendmentPayouts] = useState<Record<string, false>>({});
  const onAmendmentPayoutValidityChange = useCallback((key: string, valid: boolean) => {
    const current = amendmentPayoutValidityRef.current;
    if ((valid && !Object.hasOwn(current, key)) || (!valid && current[key] === false)) return;
    const next = { ...current };
    if (valid) delete next[key]; else next[key] = false;
    amendmentPayoutValidityRef.current = next; setInvalidAmendmentPayouts(next);
  }, []);
  const [linkedReady, setLinkedReady] = useState(false);
  const [linkChoices, setLinkChoices] = useState<SetupEventLinkChoice[]>([]);
  const [savedLinks, setSavedLinks] = useState<SetupEventLinksSnapshot | null>(null);
  const [scheduleBlocked, setScheduleBlocked] = useState(true);
  const [savedStamp, setSavedStamp] = useState<{ at: string; timezone: string; version: number } | null>(null);
  const [saveOutcome, setSaveOutcome] = useState<"loaded" | "saving" | "confirmed" | "rejected">("loaded");
  const declarationDirtyRows = useRef(new Set<string>()), declarationEpoch = useRef(0), declarationCheckFlight = useRef(false);
  const [declarationDirtyCount, setDeclarationDirtyCount] = useState(0);
  const [declarationPin, setDeclarationPin] = useState("");
  const [reviewedDeclarationPins, setReviewedDeclarationPins] = useState<DeclarationActivationPin[] | null>(null);
  const [declarationChecking, setDeclarationChecking] = useState(false);
  const [amendmentBindingMode, setAmendmentBindingMode] = useState<"unknown" | "legacy" | "v2">("unknown");
  const [sidePoolTypesReady, setSidePoolTypesReady] = useState(false);
  const [legacySideRequestBlocked, setLegacySideRequestBlocked] = useState(false);
  const [activationRecoveryBlocked, setActivationRecoveryBlocked] = useState(false);
  const onScheduleBlockingChange = useCallback((value: boolean) => setScheduleBlocked(value), []);
  const [amendmentEvents, setAmendmentEvents] = useState<SetupEvent[]>([]), [pendingAmendment, setPendingAmendment] = useState<PendingAmendment | null>(null), [primaryDirectorName, setPrimaryDirectorName] = useState(""), [isPrimaryDirector, setIsPrimaryDirector] = useState(false), [publicDirectorDraft, setPublicDirectorDraft] = useState(""), [publicContactBusy, setPublicContactBusy] = useState(false), [activationStatusAvailable, setActivationStatusAvailable] = useState(true), [finalizationPromptOpen, setFinalizationPromptOpen] = useState(false), [sanctioningFee, setSanctioningFee] = useState<{ mainRateCents: number; consolationRateCents: number; mainEligibleParticipantCount: number; consolationEligibleParticipantCount: number } | null>(null), [sanctioningFeeLastUpdatedAt, setSanctioningFeeLastUpdatedAt] = useState<number | null>(null), [sanctioningFeeRefreshing, setSanctioningFeeRefreshing] = useState(false), [rateOverrideBusy, setRateOverrideBusy] = useState(false), [teamUpgradeBusy, setTeamUpgradeBusy] = useState(false), [creationSeedActive, setCreationSeedActive] = useState(Boolean(creationSeed));
  const load = useCallback(async (expected?: {request: SetupSaveRequest; receipt: {revisionId:string;version:number}}) => {
    const owner=settingsOwner,loadEpoch=++loadSequence.current;
    if(eventSettingsV3Enabled)setSettingsState(null);
    if(eventPrizeSettingsV1Enabled)setPrizeState(null);
    if(eventPrizeSettingsV1Enabled&&eventSettingsV3Enabled)throw new Error("conflicting-settings-protocols");
    const [response, activationResponse, linkedResponse, settingsResponse, prizeResponse] = await Promise.all([
      fetch(`/api/v1/tournaments/${tournamentId}/setup`, { credentials: "same-origin", cache: "no-store" }),
      fetch(`/api/v1/tournaments/${tournamentId}/setup/activation`, { credentials: "same-origin", cache: "no-store" }),
      fetch(`/api/v1/tournaments/${tournamentId}/setup/linked`, { credentials: "same-origin", cache: "no-store" }).catch(() => null),
      eventSettingsV3Enabled ? fetch(`/api/v1/tournaments/${tournamentId}/event-settings-v3`,{credentials:"same-origin",cache:"no-store",headers:{"x-expected-actor-id":actorId}}).catch(()=>null) : Promise.resolve(null),
      eventPrizeSettingsV1Enabled ? fetch(`/api/v1/tournaments/${tournamentId}/event-prize-settings`,{credentials:"same-origin",cache:"no-store",headers:{"x-expected-actor-id":actorId}}).catch(()=>null) : Promise.resolve(null),
    ]);
    const data: unknown = await response.json().catch(() => null);
    if(settingsOwnerRef.current!==owner||loadSequence.current!==loadEpoch)throw new Error("setup-load-superseded");
    if (!response.ok || !data || typeof data !== "object") throw new Error("load");
    const result = data as Record<string, unknown>;
    if (!isSetupWorkspace(result.workspace) || !isSetupOfficialChoices(result.officialChoices)) throw new Error("shape");
    if (result.sidePoolTypesReady !== undefined && typeof result.sidePoolTypesReady !== "boolean") throw new Error("side-pool-capability-shape");
    setSidePoolTypesReady(result.sidePoolTypesReady === true);
    const linkData: unknown = linkedResponse?.ok ? await linkedResponse.json().catch(() => null) : null;
    if (!linkedResponse || (!linkedResponse.ok && linkedResponse.status !== 404) || (linkedResponse.ok && !isSetupEventLinksWorkspace(linkData))) throw new Error("linked-capability-unavailable");
    const linksAvailable = isSetupEventLinksWorkspace(linkData);
    const settingsData:unknown=eventSettingsV3Enabled&&settingsResponse?.ok?await settingsResponse.json().catch(()=>null):null;
    const prizeData:unknown=eventPrizeSettingsV1Enabled&&prizeResponse?.ok?await prizeResponse.json().catch(()=>null):null;
    if(settingsOwnerRef.current!==owner||loadSequence.current!==loadEpoch)throw new Error("setup-load-superseded");
    if(eventSettingsV3Enabled&&(!linksAvailable||!eventSettingsWorkspaceCoversSetupV3(settingsData,actorId,tournamentId,result.workspace.current?.revisionId??null,result.workspace.current?.version??0,result.workspace.current?.events??[])))throw new Error("versioned-settings-unavailable");
    if(eventPrizeSettingsV1Enabled&&(!linksAvailable||!prizeWorkspaceCoversSetupV1(prizeData,actorId,tournamentId,result.workspace.current?.revisionId??null,result.workspace.current?.version??0,result.workspace.current?.events??[])))throw new Error("prize-settings-unavailable");
    setPendingYesMainIds([]); setLinkedReady(linksAvailable); setSavedLinks(linksAvailable ? linkData.current : null); setLinkChoices(linksAvailable ? linkData.current?.choices ?? [] : []);
    const workspace = result.workspace;
    const current = workspace.current;
    if((eventSettingsV3Enabled||eventPrizeSettingsV1Enabled)&&linksAvailable&&(current?linkData.current?.setupRevisionId!==current.revisionId||linkData.current?.setupVersion!==current.version:linkData.current!==null))throw new Error("linked-settings-source-mismatch");
    if (expected && current && current.version > expected.receipt.version) throw new Error("newer-setup-revision");
    if (expected && !setupFinancialTermsMatch(expected.request, expected.receipt, current)) throw new Error("saved-financial-terms-mismatch");
    if (current) clearCreationSeed(creationSeedStorageKey);
    const effectiveCreationSeed = creationSeed ?? (!current ? readCreationSeed(creationSeedStorageKey, tournamentId) : undefined);
    setCreationSeedActive(Boolean(effectiveCreationSeed && !current));
    const legacyDirector = current ? splitPersonName(current.tournamentDirectorPublicName) : null;
    const nextPayload = current ? { tournamentName: current.tournamentName, city: current.city, venue: current.venue, venueName: current.venueName || current.venue, venueStreet: current.venueStreet, venuePostalCode: current.venuePostalCode, stateTerritory: current.stateTerritory, startsAt: current.startsAt.slice(0, 16), endsAt: current.endsAt.slice(0, 16), timezone: current.timezone, tournamentDirectorPublicName: current.tournamentDirectorPublicName, tournamentDirectorFirstName: current.tournamentDirectorFirstName || legacyDirector?.firstName || "", tournamentDirectorLastName: current.tournamentDirectorLastName || legacyDirector?.lastName || "", tournamentContactPhone: current.tournamentContactPhone, tournamentContactEmail: current.tournamentContactEmail, tournamentMailingAddress: current.tournamentMailingAddress, mainSanctioningFeeRateCents: current.mainSanctioningFeeRateCents, consolationSanctioningFeeRateCents: current.consolationSanctioningFeeRateCents, mainSanctioningFeeOverrideReason: current.mainSanctioningFeeOverrideReason, mainSanctioningFeeOverrideReference: current.mainSanctioningFeeOverrideReference, consolationSanctioningFeeOverrideReason: current.consolationSanctioningFeeOverrideReason, consolationSanctioningFeeOverrideReference: current.consolationSanctioningFeeOverrideReference, officials: current.officials, events: current.events.map(editableEvent) } : blankPayload(result.officialChoices, effectiveCreationSeed);
    setPayload(nextPayload);
    // The rates come from the workspace, NOT from the saved setup payload. A
    // rate override is recorded against the tournament and takes effect even
    // when setup has never been saved, so reading the rate off the payload
    // would show the old rate back to a director who just changed it.
    setSanctioningFee({ mainRateCents: workspace.sanctioningFee.mainRateCents, consolationRateCents: workspace.sanctioningFee.consolationRateCents, mainEligibleParticipantCount: workspace.sanctioningFee.mainEligibleParticipantCount, consolationEligibleParticipantCount: workspace.sanctioningFee.consolationEligibleParticipantCount });
    setSanctioningFeeLastUpdatedAt(Date.now());
    if(eventSettingsV3Enabled&&eventSettingsWorkspaceCoversSetupV3(settingsData,actorId,tournamentId,current?.revisionId??null,current?.version??0,current?.events??[])) {const choices=choicesFromEventSettingsWorkspaceV3(settingsData);setSettingsState({owner,workspace:settingsData,choices,saved:canonicalEventSettingsClientV3(choices)});}
    if(eventPrizeSettingsV1Enabled&&prizeWorkspaceCoversSetupV1(prizeData,actorId,tournamentId,current?.revisionId??null,current?.version??0,current?.events??[])){const workspace=readEventPrizeWorkspaceV1(prizeData,actorId,tournamentId)!;const choices=choicesFromPrizeWorkspaceV1(workspace);setPrizeState({owner,workspace,...choices,saved:canonicalEventSettingsClientV3(choices)});}
    setPrimaryDirectorName(result.officialChoices.directorDisplayName);
    setIsPrimaryDirector(result.officialChoices.directorProfileId === actorId);
    setPublicDirectorDraft(nextPayload.tournamentDirectorPublicName);
    setSavedFingerprint(current ? JSON.stringify(nextPayload) : "");
    setRevisionId(current?.revisionId ?? null);
    setVersion(current?.version ?? 0);
    setSavedStamp(current ? { at: current.createdAt, timezone: current.timezone, version: current.version } : null);
    setSaveOutcome("loaded");
    let nextActivation: SetupActivationState = { status: "not_activated" };
    let nextActivationStatusAvailable = false;
    if (activationResponse.ok) {
      const activationData: unknown = await activationResponse.json().catch(() => null);
      if(settingsOwnerRef.current!==owner||loadSequence.current!==loadEpoch)throw new Error("setup-load-superseded");
      if (isSetupActivationState(activationData)) {
        nextActivation = activationData;
        nextActivationStatusAvailable = true;
        setActivationState(activationData);
      }
    }
    setActivationStatusAvailable(nextActivationStatusAvailable);
    setMessage(!nextActivationStatusAvailable ? `Saved setup version ${current?.version ?? 0} is loaded. Event finalization status could not be checked; refresh before finalizing.` : nextActivation.status === "activated" ? `${nextActivation.eventCount} tournament event${nextActivation.eventCount === 1 ? "" : "s"} finalized for use.` : current ? `Saved setup version ${current.version} is loaded.` : "Enter the tournament details, then save the first version.");
    return { activation: nextActivation, currentVersion: current?.version ?? 0, eventSettings:settingsData,prizeSettings:prizeData, linked:linkData };
  }, [actorId, creationSeed, creationSeedStorageKey, tournamentId, setPublicDirectorDraft, eventSettingsV3Enabled,eventPrizeSettingsV1Enabled, settingsOwner]);
  useEffect(() => { void (async () => { const loadEpoch=loadSequence.current+1;setBusy(true); if(eventPrizeSettingsV1Enabled){const saved=readPending(storageKey,actorId,tournamentId);if(saved?.kind==="tournament-event-prize-v1"){setPending(saved);setPayload(saved.request.payload);setVersion(saved.request.expectedVersion);}} try { const loaded = await load(); if(settingsOwnerRef.current!==settingsOwner)return; const active = loaded.activation; const recoveredActivation = readPendingActivation(activationStorageKey,actorId,tournamentId); if(recoveredActivation?.kind==="tournament-prize-activation-v1"){setPendingActivation(recoveredActivation);setActivationRecoveryBlocked(!eventPrizeSettingsV1Enabled);setMessage("A retained registration request needs its exact operation checked before anything is cleared.");} else if (active.status === "activated") { if (sessionStorage.getItem(activationStorageKey)!==null) { setActivationRecoveryBlocked(true); setMessage("An earlier finalization request remains saved. Keep it intact for recovery."); } } else if (recoveredActivation) { setPendingActivation(recoveredActivation); setMessage("A previous finalization could not be confirmed. Retry the exact request."); } if (sessionStorage.getItem(`${activationStorageKey}:blocked`)!==null || (sessionStorage.getItem(activationStorageKey)!==null && !recoveredActivation)) { setActivationRecoveryBlocked(true); setMessage("Saved finalization recovery needs review. Keep the original request intact."); } const recovered = readPending(storageKey,actorId,tournamentId); if(eventSettingsV3Enabled||eventPrizeSettingsV1Enabled)setSettingsRecoveryBlocked(sessionStorage.getItem(storageKey)!==null&&!recovered); if (recovered && active.status !== "activated") { setPending(recovered); setCreationSeedActive(false); setPayload(recovered.request.payload); if(recovered.kind==="tournament-event-prize-v1"){setLinkChoices(recovered.envelope.setup.setup.choices);setPrizeState(previous=>previous?.owner===settingsOwner?{...previous,settings:Object.fromEntries(recovered.envelope.setup.eventSettings.map(choice=>[choice.eventClientRowId,choice])),prizes:Object.fromEntries(recovered.envelope.prizePlans.map(choice=>[choice.eventClientRowId,choice]))}:previous);} if(recovered.kind==="tournament-event-settings-v3")setSettingsState(previous=>previous?.owner===settingsOwner?{...previous,choices:Object.fromEntries(recovered.envelope.eventSettings.map(choice=>[choice.eventClientRowId,choice]))}:previous); if (recovered.kind === "tournament-setup-linked-v1") setLinkChoices(recovered.choices); setVersion(recovered.request.expectedVersion); const reason = readSideRecoveryBlock(storageKey, recovered.request.idempotencyKey); setLegacySideRequestBlocked(reason !== null); setMessage(reason ? sideRecoveryBlockMessage(reason) : recovered.accepted && loaded.currentVersion > recovered.accepted.version ? "Another director saved a newer setup revision. The accepted request and its original terms remain retained. Review the conflicting versions before finalizing." : "A previous setup save could not be confirmed. Retry the exact saved request before editing."); } const recoveredAmendment = readPendingAmendment(amendmentStorageKey); if (recoveredAmendment && active.status === "activated") { setPendingAmendment(recoveredAmendment); setAmendmentEvents(recoveredAmendment.request.events); const reason = readSideRecoveryBlock(amendmentStorageKey, recoveredAmendment.request.operationId); setLegacySideRequestBlocked(reason !== null); setMessage(reason ? sideRecoveryBlockMessage(reason) : "A previous event addition could not be confirmed. Retry the exact request before making another change."); } } catch { if(settingsOwnerRef.current===settingsOwner&&loadSequence.current===loadEpoch)setMessage("Tournament setup is temporarily unavailable. Refresh to retry; versioned settings never fall back to a legacy writer."); } finally { if(settingsOwnerRef.current===settingsOwner&&loadSequence.current===loadEpoch)setBusy(false); } })(); }, [activationStorageKey, amendmentStorageKey, load, storageKey, loadAttempt, actorId, tournamentId, eventSettingsV3Enabled,eventPrizeSettingsV1Enabled, settingsOwner]);
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
      // The rates come from the workspace, NOT from the saved setup payload. A
    // rate override is recorded against the tournament and takes effect even
    // when setup has never been saved, so reading the rate off the payload
    // would show the old rate back to a director who just changed it.
    setSanctioningFee({ mainRateCents: workspace.sanctioningFee.mainRateCents, consolationRateCents: workspace.sanctioningFee.consolationRateCents, mainEligibleParticipantCount: workspace.sanctioningFee.mainEligibleParticipantCount, consolationEligibleParticipantCount: workspace.sanctioningFee.consolationEligibleParticipantCount });
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
  useEffect(() => {
    if (!activated) return;
    let active = true;
    void fetch(`/api/v1/tournaments/${tournamentId}/setup/activation/capability`, { credentials: "same-origin", cache: "no-store" })
      .then(async response => response.ok ? response.json() as Promise<unknown> : null)
      .then(value => { if (!active) return; if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'available,hasV2Bindings,protocol' || (value as Record<string, unknown>).available !== true || (value as Record<string, unknown>).protocol !== 'event-prize-pins-v1' || typeof (value as Record<string, unknown>).hasV2Bindings !== 'boolean') { setAmendmentBindingMode('unknown'); return; } setAmendmentBindingMode((value as Record<string, unknown>).hasV2Bindings ? 'v2' : 'legacy'); })
      .catch(() => { if (active) setAmendmentBindingMode('unknown'); });
    return () => { active = false; };
  }, [activated, tournamentId]);
  const prizeScheduleApplies = !eventPrizeSettingsV1Enabled && !linkedReady && !!payload && supportsSetupPrizeSchedule(payload.events);
  const scheduleBlocksActivation = eventSettingsActivationBlockedV3(eventSettingsV3Enabled,prizeScheduleApplies,scheduleBlocked);
  const multiEventDeclarationPath = !eventPrizeSettingsV1Enabled && !!payload && (linkedReady || payload.events.length > 1) && payload.events.some(event => (event.eventKind === "main" || event.eventKind === "consolation") && event.entryFeeCents > 0);
  const tournamentDetailsSaved = useMemo(() => {
    if (!revisionId || !savedFingerprint) return false;
    try { return tournamentDetailIssues(JSON.parse(savedFingerprint) as SetupPayload).length === 0; }
    catch { return false; }
  }, [revisionId, savedFingerprint]);
  const tournamentDetailsIssues = useMemo(() => payload ? tournamentDetailIssues(payload) : [], [payload]);
  const tournamentDetailsReady = tournamentDetailsIssues.length === 0;
  const needsEventOrdering = !!payload && !activated && linkedReady && JSON.stringify(payload.events.map(event => event.clientRowId)) !== JSON.stringify(canonicalGuidedEvents(payload.events,linkChoices).map(event => event.clientRowId));
  const activationDraftLocked = !!pendingActivation || activationRecoveryBlocked;
  const draftEditingDisabled = busy || declarationChecking || !!pending || activated || activationDraftLocked || settingsRecoveryBlocked || (eventSettingsV3Enabled&&!settingsReady) || (eventPrizeSettingsV1Enabled&&(!prizeReady||finalizationPromptOpen));
  const settingsDirty=!!payload&&settingsReady&&canonicalEventSettingsClientV3(Object.fromEntries(eventSettingsChoicesForPayloadV3(payload.events,settingsState.choices).map(choice=>[choice.eventClientRowId,choice])))!==settingsState.saved;
  const prizeDirty=!!payload&&prizeReady&&prizeState!==null&&canonicalEventSettingsClientV3({settings:Object.fromEntries(eventSettingsChoicesForPayloadV3(payload.events,prizeState.settings).map(c=>[c.eventClientRowId,c])),prizes:Object.fromEntries(prizeChoicesForPayloadV1(payload.events,prizeState.prizes).map(c=>[c.eventClientRowId,c]))})!==prizeState.saved;
  const dirty = !!payload && (settingsDirty || prizeDirty || Object.keys(invalidPayouts).length > 0 || JSON.stringify(payload) !== savedFingerprint || (linkedReady && (needsEventOrdering || pendingYesMainIds.length > 0 || JSON.stringify(linkChoices) !== JSON.stringify(savedLinks?.choices ?? []))));
  const prizeReviewPin=prizeState?`${prizeState.workspace.base.setupRevisionId}:${prizeState.workspace.settings.id}:${prizeState.workspace.prizes.snapshot?.prizeSnapshotId}`:'';
  const prizeConfigured=!!payload&&prizeReady&&prizeState!==null&&prizeState.workspace.events.length>0&&payload.events.every(e=>['main','consolation','satellite'].includes(e.eventKind)&&e.styleCode==='Standard'&&e.formatCode==='standard_singles')&&prizeState.workspace.events.every(row=>{const s=prizeState.workspace.settings.snapshot?.settings.find(x=>x.eventClientRowId===row.eventClientRowId),p=prizeState.workspace.prizes.snapshot?.plans.find(x=>x.eventClientRowId===row.eventClientRowId);return s?.mode==='configured'&&!!resolveEventSeriesDraftV1(s.draft)&&p?.mode==='proposed_v2'&&inspectPlayoffPrizePlanV2(p.draft,{status:'unknown',qualifierCount:null,firstRoundLoserPlaces:null,entryFeeMinor:null}).status!=='blocked';});
  const prizeReviewReady=prizeRuleReady?.owner===settingsOwner&&prizeRuleReady.pin===prizeReviewPin&&prizeRuleReady.ready;
  const currentDeclarationPin = `${version}:${revisionId ?? ""}:${savedFingerprint}`;
  const declarationsReady = !!declarationPin && !!reviewedDeclarationPins && declarationPin === currentDeclarationPin && !dirty && declarationDirtyCount === 0;
  const declarationState = useRef({ pin: "", dirty: true, pending: true, pendingActivation: true });
  useEffect(() => { declarationState.current = { pin: currentDeclarationPin, dirty, pending: !!pending, pendingActivation: !!pendingActivation }; }, [currentDeclarationPin, dirty, pending, pendingActivation]);
  useEffect(() => { if (dirty || pending || pendingActivation) void Promise.resolve().then(() => { setDeclarationPin(""); setReviewedDeclarationPins(null); }); }, [dirty, pending, pendingActivation]);
  function declarationDraftChanged(row: string, value: boolean) {
    if (value) declarationDirtyRows.current.add(row); else declarationDirtyRows.current.delete(row);
    declarationEpoch.current++; setDeclarationDirtyCount(declarationDirtyRows.current.size); setDeclarationPin(""); setReviewedDeclarationPins(null);
  }
  // Setup edits live in component state until Save All Events Draft is pressed.
  // Leaving the page discards them, and a director lost a part-typed setup that
  // way by stepping out to add an official. Warn on hard navigation, and keep a
  // visible notice on screen for in-app links, which beforeunload cannot see.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const effectiveMainRateCents = sanctioningFee?.mainRateCents ?? payload?.mainSanctioningFeeRateCents ?? DEFAULT_MAIN_SANCTIONING_FEE_RATE_CENTS;
  const effectiveConsolationRateCents = sanctioningFee?.consolationRateCents ?? payload?.consolationSanctioningFeeRateCents ?? DEFAULT_CONSOLATION_SANCTIONING_FEE_RATE_CENTS;
  const sanctioningFeeRunningTotalCents = payload ? calculateSanctioningFeeRunningTotalCents({ mainEligibleParticipantCount: sanctioningFee?.mainEligibleParticipantCount ?? 0, consolationEligibleParticipantCount: sanctioningFee?.consolationEligibleParticipantCount ?? 0 }, { mainRateCents: effectiveMainRateCents, consolationRateCents: effectiveConsolationRateCents }) : 0;
  function updateEvent(clientRowId: string, value: SetupEvent) { if (!payload || !tournamentDetailsSaved || draftEditingDisabled) return; setPayload({ ...payload, events: payload.events.map((event) => event.clientRowId === clientRowId ? value : event) }); }
  function add(kind: SetupEvent["eventKind"]) { if (!payload || !tournamentDetailsSaved || draftEditingDisabled || payload.events.length >= 32 || (linkedReady && kind === "satellite" && (pendingYesMainIds.length > 0 || !validateSetupEventLinks(payload.events,linkChoices).complete)) || (!linkedReady && (kind === "main" || kind === "consolation") && counts[kind])) return; const added = defaultEvent(kind, payload.startsAt, payload.timezone); setPayload({ ...payload, events: linkedReady && kind === "main" && !counts.main ? [added, ...payload.events] : [...payload.events, added] }); }
  function enqueuePrizeSettings(request:SetupSaveRequest,stage:'details'|'all'){
    if(!eventPrizeSettingsV1Enabled||eventSettingsV3Enabled||!prizeReady||!prizeState||inFlight.current||settingsOwnerRef.current!==settingsOwner)return;
    const operation=buildPendingEventPrizeSetupV1(actorId,prizeState.workspace,request,linkChoices,prizeState.settings,prizeState.prizes,stage,crypto.randomUUID());
    if(!operation){setMessage("The full Playoff request could not be retained. Review historical or unsupported pool settings; no legacy writer was attempted.");return;}
    if(!storePending(storageKey,operation)){setMessage("This browser cannot safely retain the complete Playoff request. Nothing was sent.");return;}
    void savePrizeSettings(operation);
  }
  async function savePrizeSettings(operation:PendingEventPrizeSetupV1,checkOnly=false){
    if(!eventPrizeSettingsV1Enabled||eventSettingsV3Enabled||operation.actorId!==actorId||operation.envelope.setup.setup.base.tournamentId!==tournamentId||inFlight.current||activationDraftLocked||settingsOwnerRef.current!==settingsOwner){setMessage("The Playoff transport is unavailable. Keep the original request intact.");return;}
    const owner=settingsOwner,owned=()=>settingsOwnerRef.current===owner,raw=serializePendingEventPrizeSetupV1(operation);
    if(!raw||sessionStorage.getItem(storageKey)!==raw){setSettingsRecoveryBlocked(true);setMessage("The retained Playoff request changed. Keep all recovery work intact.");return;}
    inFlight.current=true;setBusy(true);setPending(operation);setSaveOutcome("saving");
    setPrizeResolution(null);
    try{
      const hash=await eventPrizeSettingsRequestHashV1(operation.envelope,operation.envelope.setup.setup.base);if(!hash)throw Error("hash-unavailable");if(!owned())return;assertRecoveryStorageOwner(actorId);assertRecoveryWriteAllowed();
      let first:ReturnType<typeof readEventPrizeAcceptedReplyV1>=null;
      const send=async(reconcile:boolean)=>{assertRecoveryStorageOwner(actorId);assertRecoveryWriteAllowed();return fetch(`/api/v1/tournaments/${tournamentId}/event-prize-settings${reconcile?"/reconcile":""}`,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json","x-expected-actor-id":actorId},body:JSON.stringify(operation.envelope)});};
      if(!checkOnly){const response=await send(false),value:unknown=await response.json().catch(()=>null);if(!owned())return;if(response.status===401||response.status===403){setSettingsRecoveryBlocked(true);setMessage("Access changed. Your exact Playoff request remains retained.");return;}first=response.ok?readEventPrizeAcceptedReplyV1(value,operation.envelope,hash,actorId):null;if(!first){setMessage("The Playoff save is unconfirmed or rejected. Check its saved outcome before changing this request.");return;}}
      const response=await send(true),value:unknown=await response.json().catch(()=>null);if(!owned())return;
      if(response.status===401||response.status===403){setSettingsRecoveryBlocked(true);setMessage("Access changed. Your exact Playoff request remains retained.");return;}
      const verified=response.ok?readEventPrizeAcceptedReplyV1(value,operation.envelope,hash,actorId):null;
      const source=await fetch(`/api/v1/tournaments/${tournamentId}/event-prize-settings`,{credentials:"same-origin",cache:"no-store",headers:{"x-expected-actor-id":actorId}}),fresh:unknown=source.ok?await source.json().catch(()=>null):null;if(!owned())return;
      const resolution=assessEventPrizePendingResolutionV1(operation,value,fresh,hash);
      if(resolution){setPrizeResolution({owner,raw,proof:resolution,confirm:false});setMessage(resolution.outcome==='confirmed_rejected'?"The original operation has a verified rejection record. Review before removing only this local request and loading the saved draft.":resolution.outcome==='confirmed_superseded'?"This save is confirmed in history, but a newer draft exists. Review before loading the latest draft.":"This request was not applied, and its setup version is now stale. Review before discarding this local request and loading the latest draft.");return;}
      if(!verified||(first&&canonicalEventSettingsClientV3(first)!==canonicalEventSettingsClientV3(verified))){setMessage("The complete saved Playoff operation could not be confirmed. The exact request remains retained; no new operation was created.");return;}
      const loaded=await load({request:operation.request,receipt:verified.ack.nested.linked.result});if(!owned())return;
      if(!eventPrizeReadbackMatchesV1(loaded.prizeSettings,operation,verified.ack,verified.priorSnapshot,hash)||!isSetupEventLinksWorkspace(loaded.linked)||!linkedSnapshotMatches(loaded.linked.current,verified.ack.nested.linked.links)){setMessage("Current setup or Playoff settings do not match the saved operation. Keep the exact request for review.");return;}
      assertRecoveryStorageOwner(actorId);assertRecoveryWriteAllowed();if(sessionStorage.getItem(storageKey)!==raw)throw Error("pending-changed");sessionStorage.removeItem(storageKey);if(sessionStorage.getItem(storageKey)!==null)throw Error("cleanup-unconfirmed");
      setPending(null);setSaveOutcome("confirmed");clearCreationSeed(creationSeedStorageKey);setCreationSeedActive(false);
      setMessage(operation.stage==='details'?"Tournament details and Playoff settings saved. Tournament Events is now available.":`Tournament setup version ${verified.ack.snapshot.setupVersion} and its complete Playoff settings were saved and verified.`);
    }catch{if(owned())setMessage("The Playoff save or readback is unresolved. Keep the exact request; check its outcome before retrying.");}finally{if(owned()){inFlight.current=false;setBusy(false);}}
  }
  async function resolvePrizePending(){
    const resolution=prizeResolution,operation=pending;
    if(!eventPrizeSettingsV1Enabled||!resolution?.confirm||resolution.owner!==settingsOwner||settingsOwnerRef.current!==settingsOwner||operation?.kind!=='tournament-event-prize-v1'||operation.actorId!==actorId||operation.envelope.operationId!==resolution.proof.operationId||inFlight.current)return;
    const owner=settingsOwner,owned=()=>settingsOwnerRef.current===owner;inFlight.current=true;setBusy(true);
    try{
      if(sessionStorage.getItem(storageKey)!==resolution.raw||serializePendingEventPrizeSetupV1(operation)!==resolution.raw)throw Error("pending-changed");
      const response=await fetch(`/api/v1/tournaments/${tournamentId}/event-prize-settings`,{credentials:"same-origin",cache:"no-store",headers:{"x-expected-actor-id":actorId}}),fresh=readEventPrizeWorkspaceV1(response.ok?await response.json().catch(()=>null):null,actorId,tournamentId);if(!owned())return;
      const p=resolution.proof;if(!fresh||fresh.base.setupRevisionId!==p.currentRevisionId||fresh.base.setupVersion!==p.currentVersion||fresh.base.sourceDigest!==p.currentSourceDigest){setPrizeResolution(null);setMessage("The current setup or access changed. Keep the request and check its outcome again.");return;}
      assertRecoveryStorageOwner(actorId);assertRecoveryWriteAllowed();if(sessionStorage.getItem(storageKey)!==resolution.raw)throw Error("pending-changed");sessionStorage.removeItem(storageKey);if(sessionStorage.getItem(storageKey)!==null)throw Error("cleanup-unconfirmed");
      setPending(null);setPrizeResolution(null);await load();if(owned())setMessage("The latest saved setup is loaded. The resolved local request was removed; no tournament record was changed by this recovery action.");
    }catch{if(owned())setMessage("Recovery resolution could not be completed. Keep the remaining request and retry the read-only check.");}finally{if(owned()){inFlight.current=false;setBusy(false);}}
  }
  function enqueueSettingsV3(request:SetupSaveRequest,stage:'details'|'all') {
    if(!eventSettingsV3Enabled||!settingsReady||settingsOwnerRef.current!==settingsOwner||inFlight.current||!settingsState)return;
    const envelope=buildPendingEventSettingsSetupV3(actorId,settingsState.workspace,request,linkChoices,settingsState.choices,stage);
    if(!envelope){setMessage("Versioned settings could not be safely retained. Complete the series and factor; custom paid-ratio or unsupported historical pool sources require review. No legacy save was attempted.");return;}
    if(!storePending(storageKey,envelope)){setMessage("This browser cannot safely retain the full settings request. Nothing was sent.");return;}
    void saveSettingsV3(envelope);
  }
  async function saveSettingsV3(envelope:PendingEventSettingsSetupV3,checkOnly=false) {
    if(!eventSettingsV3Enabled||settingsOwnerRef.current!==settingsOwner||inFlight.current||activationDraftLocked){setMessage("Versioned settings transport is unavailable. The original request is retained.");return;}
    const owner=settingsOwner,current=()=>settingsOwnerRef.current===owner;
    const raw=serializePendingEventSettingsSetupV3(envelope);
    if(!raw||sessionStorage.getItem(storageKey)!==raw){setSettingsRecoveryBlocked(true);setMessage("The retained settings request changed. Keep all recovery work intact.");return;}
    inFlight.current=true;setBusy(true);setPending(envelope);setSaveOutcome("saving");
    try {
      let ack:unknown=null;
      if(!checkOnly){
        const response=await fetch(`/api/v1/tournaments/${tournamentId}/event-settings-v3`,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json","x-expected-actor-id":actorId},body:JSON.stringify(envelope.envelope)});
        const data:unknown=await response.json().catch(()=>null);if(!current())return;
        if(response.status===401||response.status===403){setSettingsRecoveryBlocked(true);setMessage("Access changed. Your full settings request remains retained; no legacy writer was attempted.");return;}
        if(response.ok&&isEventSettingsDraftSavedV3(data,envelope.envelope,envelope.envelope.setup.base))ack=data;
        else {setMessage("The settings save is unconfirmed or rejected. Keep the exact request; check its outcome before another change.");return;}
      }
      const response=await fetch(`/api/v1/tournaments/${tournamentId}/event-settings-v3/operations/${envelope.request.idempotencyKey}`,{credentials:"same-origin",cache:"no-store",headers:{"x-expected-actor-id":actorId}});
      const data:unknown=await response.json().catch(()=>null);if(!current())return;
      const operation=readEventSettingsOperationRecordV3(data,actorId,tournamentId,envelope.request.idempotencyKey,envelope.envelope);
      if(!operation||!isEventSettingsDraftSavedV3(operation.outcome,envelope.envelope,envelope.envelope.setup.base)||(ack!==null&&canonicalEventSettingsClientV3(ack)!==canonicalEventSettingsClientV3(operation.outcome))){setMessage("The full saved operation could not be confirmed. The exact request remains retained.");return;}
      ack=operation.outcome;
      const loaded=await load({request:envelope.request,receipt:operation.outcome.linked.result});if(!current())return;
      if(!eventSettingsReadbackMatchesV3(loaded.eventSettings,envelope,ack,loaded.linked)){setMessage("Current settings do not match the accepted operation. Recovery remains retained; no newer source was substituted.");return;}
      if(sessionStorage.getItem(storageKey)!==raw){setSettingsRecoveryBlocked(true);setMessage("Recovery changed during readback. Nothing was cleared.");return;}
      sessionStorage.removeItem(storageKey);if(sessionStorage.getItem(storageKey)!==null){setMessage("The save is verified, but recovery cleanup is unconfirmed. Keep this page open.");return;}
      setPending(null);setSaveOutcome("confirmed");setMessage(`Versioned setup draft ${operation.outcome.linked.result.version} and its full Playoff settings were verified. Activation remains unavailable.`);
    } catch {if(current())setMessage("Settings or storage outcome is unknown. The full retained request remains available for exact retry.");}
    finally {if(current()){inFlight.current=false;setBusy(false);}}
  }
  async function save(envelope: PendingSave) {
    const owner=settingsOwner,owned=()=>settingsOwnerRef.current===owner;if(!owned())return;
    if(envelope.kind==="tournament-event-prize-v1"){await savePrizeSettings(envelope);return;}
    if(envelope.kind==="tournament-event-settings-v3"){await saveSettingsV3(envelope);return;}
    if(eventSettingsV3Enabled||eventPrizeSettingsV1Enabled){setMessage("An earlier legacy request is retained unchanged. Versioned settings cannot fall back to a legacy writer.");return;}
    if (inFlight.current || activationDraftLocked) return; inFlight.current = true; setBusy(true); setPending(envelope); setSaveOutcome("saving"); setMessage("Saving the tournament setup…");
    if (envelope.kind === "tournament-setup-linked-v1") {
      const retained: PendingLinkedSetup = {kind:envelope.kind,request:envelope.request,choices:envelope.choices,stage:envelope.stage};
      try {
        if (JSON.stringify(parsePendingLinkedSetup(sessionStorage.getItem(storageKey))) !== JSON.stringify(retained)) throw new Error("recovery-conflict");
        const body = {kind:"setup-event-links-v1" as const,request:retained.request,choices:retained.choices};
        const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup/linked`, {method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
        const data: unknown = await response.json().catch(() => null);if(!owned())return;
        if (response.status === 409 && (isRejectedLinkedSetup(data) || isRejectedSetup(data)) && (data as {code:string}).code !== "idempotency_conflict") {
          if (clearRejectedLinkedRecovery(sessionStorage,storageKey,retained) !== "cleared") throw new Error("recovery-conflict");
          setPending(null); setSaveOutcome("rejected"); setMessage(isRejectedLinkedSetup(data) ? linkedSetupRejectionMessage(data.code) : setupRejectionMessage((data as {code:string}).code)); return;
        }
        if (!response.ok || !isLinkedSetupSaveResult(data,body)) { setMessage("The linked save is unresolved. Retry the exact saved request when the connection is available."); return; }
        const receipt = data.result;
        const ackKey = acceptedSetupKey(storageKey,retained.request.idempotencyKey); const ackRaw = sessionStorage.getItem(ackKey);
        if (ackRaw !== null) { const prior = parseAcceptedSetupReceipt(ackRaw,retained.request); if (!prior || prior.revisionId !== receipt.revisionId || prior.version !== receipt.version) throw new Error("recovery-conflict"); }
        try { setAppRecoveryItem(sessionStorage,ackKey,JSON.stringify({kind:"tournament-setup-accepted",operationId:retained.request.idempotencyKey,revisionId:receipt.revisionId,version:receipt.version})); } catch { /* retain original request */ }
        await load({request:retained.request,receipt});if(!owned())return;
        const read = await fetch(`/api/v1/tournaments/${tournamentId}/setup/linked`, {credentials:"same-origin",cache:"no-store"});
        const links: unknown = read.ok ? await read.json().catch(() => null) : null;if(!owned())return;
        if (!isSetupEventLinksWorkspace(links) || !linkedSnapshotMatches(links.current,data.links)) throw new Error("link-readback");
        if (clearVerifiedLinkedRecovery(sessionStorage,storageKey,retained,receipt) !== "cleared") throw new Error("recovery-cleanup");
        setLinkedReady(true); setSavedLinks(data.links); setLinkChoices(data.links.choices); clearCreationSeed(creationSeedStorageKey); setCreationSeedActive(false); setPending(null); setSaveOutcome("confirmed");
        setMessage(retained.stage === "details" ? "Tournament details saved. Tournament Events is now available." : `Tournament setup version ${receipt.version} was saved.`);
      } catch { if(owned())setMessage("The linked save could not be fully verified. The exact request remains saved for retry."); }
      finally { if(owned()){inFlight.current = false; setBusy(false);} }
      return;
    }
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope.request) }); const data: unknown = await response.json().catch(() => null);if(!owned())return;
      if (response.ok && isSavedSetup(data, envelope.request)) {
        const acceptedEnvelope: PendingSave = {...envelope,accepted:{revisionId:data.revisionId,version:data.version}};
        // Recovery envelopes are immutable. Store acknowledgement separately,
        // rather than overwriting the exact original request or relaxing its guard.
        try { setAppRecoveryItem(sessionStorage,acceptedSetupKey(storageKey,envelope.request.idempotencyKey),JSON.stringify({kind:"tournament-setup-accepted",operationId:envelope.request.idempotencyKey,revisionId:data.revisionId,version:data.version})); } catch { /* original request and server receipt remain available for exact replay */ }
        setPending(acceptedEnvelope);
        try {
          await load({request:envelope.request,receipt:data});if(!owned())return;
          const cleanup=clearVerifiedSetupRecovery(sessionStorage,storageKey,envelope.request,data);
          if(cleanup!=="cleared"){setPending(acceptedEnvelope);setMessage("Saved financial terms are verified, but local recovery cleanup could not be confirmed. The original operation remains available; do not finalize until this recovery state is resolved.");return;}
          clearCreationSeed(creationSeedStorageKey); setCreationSeedActive(false); setPending(null);
          setSaveOutcome("confirmed");
          setMessage(envelope.stage === "details" ? "Tournament details saved. Tournament Events is now available." : `Tournament setup version ${data.version} was saved.`);
        } catch (error) {
          if(!owned())return;
          // Accepted metadata is not proof that the saved financial terms match.
          // Keep the original operation for exact receipt replay and readback.
          setPending(acceptedEnvelope);
          setMessage(error instanceof Error && error.message === "newer-setup-revision"
            ? "Another director saved a newer setup revision before this readback. The accepted request and its original terms remain retained. Review the conflicting versions before finalizing; no newer values were assumed to match."
            : `Setup version ${data.version} was accepted, but its saved fees and pools could not be verified. The exact request is retained. Retry it before finalizing; no new request was started.`);
        }
        return;
      }
      if (response.status === 409 && (isLegacySideRequestUnbound(data) || isSidePoolRequestConflict(data))) { const reason = isLegacySideRequestUnbound(data) ? "unbound" : "conflict"; const retained = retainSideRecoveryBlock(storageKey, envelope.request.idempotencyKey, reason); const text=sideRecoveryBlockMessage(reason); setLegacySideRequestBlocked(true); setMessage(retained ? text : `${text} Keep this tab open because the warning could not be saved.`); return; }
      // Deliberately does NOT reload on a rejection. load() replaces the form with
      // the last saved version, so a rejected save used to wipe every field the
      // director had typed, including the event cards, leaving them to start over
      // with no idea what to change. Keep their work on screen next to the reason.
      if (response.status === 409 && isRejectedSetup(data)) { clearPending(storageKey); setPending(null); setSaveOutcome("rejected"); setMessage(setupRejectionMessage((data as { code?: unknown }).code)); return; }
      setMessage("The save is unresolved. Retry the exact saved version when the connection is available.");
    } catch { if(owned())setMessage("The save is unresolved. Retry the exact saved version when the connection is available."); } finally { if(owned()){inFlight.current = false; setBusy(false);} }
  }
  function startTournamentDetailsSave() {
    if (inFlight.current || !payload || tournamentDetailsSaved || draftEditingDisabled) return;
    if (sessionStorage.getItem(storageKey) !== null) { setMessage("Saved setup recovery needs review. Keep the original request intact."); return; }
    if (!tournamentDetailsReady) { setMessage(`Complete these tournament details before continuing: ${tournamentDetailsIssues.join(", ")}.`); return; }
    const initialRequest = { expectedVersion: version, payload: revisionId ? payload : { ...payload, events: [] }, idempotencyKey: crypto.randomUUID() }; const request = linkedReady ? {...initialRequest,payload:{...initialRequest.payload,events:canonicalGuidedEvents(initialRequest.payload.events,linkChoices)}} : initialRequest;
    let legacyBaseline = null; try { if (savedFingerprint) legacyBaseline = {version, events: (JSON.parse(savedFingerprint) as SetupPayload).events}; } catch { /* fail closed */ }
    if (!(sidePoolTypesReady ? isSetupSaveRequest(request) || isSetupSaveWithUnchangedLegacySides(request, legacyBaseline) : isLegacySideSetupSaveRequest(request))) { setMessage("The tournament details are not ready to save. Review every required field and try again."); return; }
    if(eventPrizeSettingsV1Enabled){enqueuePrizeSettings(request,"details");return;}
    if(eventSettingsV3Enabled){enqueueSettingsV3(request,"details");return;}
    const envelope: PendingSave = linkedReady ? { kind: "tournament-setup-linked-v1", request, choices: linkChoices, stage: "details" } : { kind: "tournament-setup", request, stage: "details" };
    if (!storePending(storageKey, envelope)) { setMessage("This browser cannot safely retain the request for recovery."); return; }
    void save(envelope);
  }
  function startSave() { if (inFlight.current || !payload || draftEditingDisabled) return; if (Object.keys(payoutValidityRef.current).length > 0) { setSaveOutcome("rejected"); setMessage("Complete each payout selection before saving this draft."); return; } if (sessionStorage.getItem(storageKey) !== null) { setMessage("Saved setup recovery needs review. Keep the original request intact."); return; } if (linkedReady && (pendingYesMainIds.length > 0 || !validateSetupEventLinks(payload.events,linkChoices).valid)) { setMessage("Finish the Consolation Yes/No choice for each Main before saving."); return; } const request = { expectedVersion: version, payload: linkedReady ? {...payload,events:canonicalGuidedEvents(payload.events,linkChoices)} : payload, idempotencyKey: crypto.randomUUID() }; let legacyBaseline = null; try { if (savedFingerprint) legacyBaseline = {version, events: (JSON.parse(savedFingerprint) as SetupPayload).events}; } catch { /* fail closed */ } if (!(sidePoolTypesReady ? isSetupSaveRequest(request) || isSetupSaveWithUnchangedLegacySides(request, legacyBaseline) : isLegacySideSetupSaveRequest(request))) { setSaveOutcome("rejected"); setMessage("Complete every required tournament and event field, including each new Side Pool payout type, before saving."); return; } if(eventPrizeSettingsV1Enabled){enqueuePrizeSettings(request,"all");return;} if(eventSettingsV3Enabled){enqueueSettingsV3(request,"all");return;} const envelope: PendingSave = linkedReady ? { kind: "tournament-setup-linked-v1", request, choices: linkChoices, stage: "all" } : { kind: "tournament-setup", request, stage: "all" }; if (!storePending(storageKey, envelope)) { setMessage("This browser cannot safely retain the request for recovery."); return; } void save(envelope); }
  async function activatePrize(operation:PendingPrizeActivationV1,checkOnly=false){
    if(!eventPrizeSettingsV1Enabled||operation.actorId!==actorId||operation.tournamentId!==tournamentId||inFlight.current||activationRecoveryBlocked||settingsOwnerRef.current!==settingsOwner)return;
    const owner=settingsOwner,owned=()=>settingsOwnerRef.current===owner,raw=serializePendingPrizeActivationV1(operation),outerRaw=serializeEventPrizeActivationV1(operation.envelope);
    if(!raw||!outerRaw||sessionStorage.getItem(activationStorageKey)!==raw){setActivationRecoveryBlocked(true);setMessage("The retained registration request changed. Keep the original work intact.");return;}
    inFlight.current=true;setBusy(true);setPendingActivation(operation);setRejectedPrizeActivation(null);
    try{
      const hash=await eventPrizeActivationRequestHashV1(operation.envelope);if(!hash)throw Error("hash-unavailable");if(!owned())return;
      const send=async(path:string)=>{assertRecoveryStorageOwner(actorId);assertRecoveryWriteAllowed();const response=await fetch(`/api/v1/tournaments/${tournamentId}/event-prize-settings/activation${path}`,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json","x-expected-actor-id":actorId},body:outerRaw});const value:unknown=await response.json().catch(()=>null);if(!owned())return null;if(response.status===401||response.status===403){setActivationRecoveryBlocked(true);return null;}return readEventPrizeActivationRecordV1(value,actorId,tournamentId,outerRaw,hash);};
      let prepared:EventPrizeActivationRecordV1|null=null,finalized:EventPrizeActivationRecordV1|null=null;
      if(!checkOnly){prepared=await send('');if(!owned())return;if(!prepared){setMessage("Registration preparation is unresolved. Keep and check the exact retained request.");return;}if(prepared.preparation.status==='activation_intent_prepared'){finalized=await send('/finalize');if(!owned())return;if(!finalized){setMessage("Registration finalization is unresolved. Check its exact operation before retrying.");return;}}}
      const verified=await send('/reconcile');if(!owned())return;
      if(!verified||(prepared&&canonicalEventSettingsClientV3(prepared.preparation)!==canonicalEventSettingsClientV3(verified.preparation))||(finalized&&canonicalEventSettingsClientV3(finalized)!==canonicalEventSettingsClientV3(verified))){setMessage("The complete registration operation could not be confirmed. The original request remains retained.");return;}
      if(verified.preparation.status==='rejected'||(verified.activation?.status==='rejected'&&verified.activation.operationalActivationPerformed===false)){setRejectedPrizeActivation({owner,raw,record:verified,confirm:false});setMessage("The registration operation was rejected without activating events. Review its recorded outcome before resolving this local request.");return;}
      const a=verified.activation;if(a?.status!=='event_settings_operationally_activated'||!isLinkedSetupActivationResult(a.result,operation.request,operation.envelope.activation.associationHash)){setMessage("Preparation is recorded, but registration has not been verified open. Keep the exact request for retry.");return;}
      const loaded=await load();if(!owned())return;const state=loaded.activation;
      const expected=a.result.result.events.map(e=>({eventId:e.eventId,eventType:e.eventType,name:e.name,format:e.format,scoringMethod:e.scoringMethod,gameCount:e.gameCount})).sort((x,y)=>String(x.eventId).localeCompare(String(y.eventId)));
      if(state.status!=='activated'||state.setupRevisionId!==operation.request.setupRevisionId||state.setupVersion!==operation.request.expectedVersion||canonicalEventSettingsClientV3([...state.events].sort((x,y)=>x.eventId.localeCompare(y.eventId)))!==canonicalEventSettingsClientV3(expected)){setMessage("The saved registration operation and current event list do not match. Keep the exact request for review.");return;}
      assertRecoveryStorageOwner(actorId);assertRecoveryWriteAllowed();if(sessionStorage.getItem(activationStorageKey)!==raw)throw Error("pending-changed");sessionStorage.removeItem(activationStorageKey);if(sessionStorage.getItem(activationStorageKey)!==null)throw Error("cleanup-unconfirmed");
      setPendingActivation(null);setActivationRecoveryBlocked(false);setRejectedPrizeActivation(null);setMessage("Registration is open with the saved Playoff policy. New-policy playoff execution and payout accounting remain unavailable; no money was moved.");
    }catch{if(owned())setMessage("The registration outcome or readback is unresolved. Keep the exact request and check its operation.");}finally{if(owned()){inFlight.current=false;setBusy(false);}}
  }
  async function resolveRejectedPrizeActivation(){
    const resolution=rejectedPrizeActivation,operation=pendingActivation;if(!resolution?.confirm||resolution.owner!==settingsOwner||operation?.kind!=='tournament-prize-activation-v1'||operation.actorId!==actorId||operation.tournamentId!==tournamentId||settingsOwnerRef.current!==settingsOwner||inFlight.current||!eventPrizeSettingsV1Enabled)return;
    const owner=settingsOwner,owned=()=>settingsOwnerRef.current===owner;inFlight.current=true;setBusy(true);
    try{const raw=serializePendingPrizeActivationV1(operation),outer=serializeEventPrizeActivationV1(operation.envelope),hash=await eventPrizeActivationRequestHashV1(operation.envelope);if(!raw||!outer||!hash||raw!==resolution.raw||sessionStorage.getItem(activationStorageKey)!==raw)throw Error("pending-changed");
      const response=await fetch(`/api/v1/tournaments/${tournamentId}/event-prize-settings/activation/reconcile`,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json","x-expected-actor-id":actorId},body:outer}),record=readEventPrizeActivationRecordV1(await response.json().catch(()=>null),actorId,tournamentId,outer,hash);if(!owned())return;
      if(!record||canonicalEventSettingsClientV3(record)!==canonicalEventSettingsClientV3(resolution.record)||!(record.preparation.status==='rejected'||(record.activation?.status==='rejected'&&record.activation.operationalActivationPerformed===false)))throw Error("unconfirmed-rejection");
      assertRecoveryStorageOwner(actorId);assertRecoveryWriteAllowed();if(sessionStorage.getItem(activationStorageKey)!==raw)throw Error("pending-changed");sessionStorage.removeItem(activationStorageKey);if(sessionStorage.getItem(activationStorageKey)!==null)throw Error("cleanup-unconfirmed");setPendingActivation(null);setRejectedPrizeActivation(null);await load();if(owned())setMessage("The recorded rejection remains in history. The resolved local request was removed; review the latest saved setup before trying finalization again.");
    }catch{if(owned())setMessage("The rejected registration request could not be safely resolved. It remains retained where available.");}finally{if(owned()){inFlight.current=false;setBusy(false);}}
  }
  async function confirmPrizeRegistration(){
    if(!eventPrizeSettingsV1Enabled||!prizeReady||!prizeState||!prizeConfigured||!prizeReviewReady||!revisionId||dirty||busy||pending||pendingActivation||activationRecoveryBlocked||inFlight.current||settingsOwnerRef.current!==settingsOwner)return;
    const owner=settingsOwner,expected=prizeState.workspace,reviewed=prizeRuleReady?.reviews;inFlight.current=true;setBusy(true);
    let operation:PendingPrizeActivationV1|null=null;
    try{const response=await fetch(`/api/v1/tournaments/${tournamentId}/event-prize-settings/activation`,{credentials:"same-origin",cache:"no-store",headers:{"x-expected-actor-id":actorId}}),source=readEventPrizeActivationSourceV1(response.ok?await response.json().catch(()=>null):null,actorId,tournamentId);if(settingsOwnerRef.current!==owner)return;
      const currentReview=prizeRuleEvidenceRef.current;
      if(!source||canonicalEventSettingsClientV3(source.workspace)!==canonicalEventSettingsClientV3(expected)||!reviewed||currentReview?.owner!==owner||currentReview.pin!==prizeReviewPin||canonicalEventSettingsClientV3(currentReview.reviews)!==canonicalEventSettingsClientV3(reviewed)||!eventPrizeRuleContextReviewsMatchV1(reviewed,source)){prizeRuleEvidenceRef.current=null;setPrizeRuleReady(null);setFinalizationPromptOpen(false);setMessage("The saved policy, event links or displayed rule reviews changed. Open finalization again and review the latest saved context; no registration request was sent.");return;}
      const envelope=buildEventPrizeActivationV1(source,crypto.randomUUID());if(!envelope)throw Error("activation-source-unavailable");operation={kind:'tournament-prize-activation-v1',actorId,tournamentId,envelope,request:envelope.activation.request};
      if(!storePending(activationStorageKey,operation))throw Error("storage-unavailable");setPendingActivation(operation);setFinalizationPromptOpen(false);
    }catch{operation=null;if(settingsOwnerRef.current===owner){setActivationRecoveryBlocked(true);setMessage("The full registration request could not be safely prepared and retained. Keep any existing recovery work; no legacy finalizer was attempted.");}}finally{if(settingsOwnerRef.current===owner){inFlight.current=false;setBusy(false);}}
    if(operation&&settingsOwnerRef.current===owner)void activatePrize(operation);
  }
  async function activate(envelope: PendingActivation) {
    const owner=settingsOwner,owned=()=>settingsOwnerRef.current===owner;if(!owned())return;
    if(envelope.kind==='tournament-prize-activation-v1'){await activatePrize(envelope);return;}
    if(eventSettingsV3Enabled||eventPrizeSettingsV1Enabled){setMessage("Configured Playoff activation is unavailable until the reviewed operational provider is integrated. Recovery remains intact.");return;}
    if (inFlight.current || activationRecoveryBlocked) return; inFlight.current = true; setBusy(true); setPendingActivation(envelope); setMessage("Activating the tournament events…");
    try { const expected = JSON.stringify(envelope); if(sessionStorage.getItem(activationStorageKey)!==expected){setActivationRecoveryBlocked(true);setMessage("Saved finalization work changed. It remains intact; do not create another request.");return;} const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup/${envelope.kind === "tournament-activation-linked-v1" ? "linked/activation" : "activation"}`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope.kind === "tournament-activation-linked-v1" ? {request:envelope.request,associationHash:envelope.associationHash} : envelope.request) }); const data: unknown = await response.json().catch(() => null);if(!owned())return;
      if(sessionStorage.getItem(activationStorageKey)!==expected){setActivationRecoveryBlocked(true);setMessage("Saved finalization work changed while waiting. It remains intact; do not create another request.");return;}
      const activationResult = envelope.kind === "tournament-activation-linked-v1" ? (isLinkedSetupActivationResult(data,envelope.request,envelope.associationHash) ? data.result : null) : (isSetupActivationResult(data,envelope.request) ? data : null);
      if (response.ok && activationResult) { sessionStorage.removeItem(activationStorageKey);if(sessionStorage.getItem(activationStorageKey)!==null){setActivationRecoveryBlocked(true);setMessage("Events were finalized, but local recovery cleanup could not be confirmed. Keep this tab open.");return;} setPendingActivation(null); setMessage(`${activationResult.eventCount} event${activationResult.eventCount === 1 ? "" : "s"} finalized. Registration is now open; ${registrationLinkManagementEnabled ? "opening the QR and registration-link workspace." : "returning to the tournament workspace."}`); router.push((registrationLinkManagementEnabled ?? false) ? `/tournament/${tournamentId}/registration` : `/tournament/${tournamentId}`); return; }
      if (response.status === 409 && envelope.kind === "tournament-activation-linked-v1" && (isRejectedLinkedSetup(data) || isRejectedSetupActivation(data)) && data.code !== "idempotency_conflict") {
        if (sessionStorage.getItem(activationStorageKey) !== expected) { setActivationRecoveryBlocked(true); setMessage("Saved finalization work changed. It remains intact for review."); return; }
        sessionStorage.removeItem(activationStorageKey); if (sessionStorage.getItem(activationStorageKey) !== null) { setActivationRecoveryBlocked(true); setMessage("Finalization was rejected, but recovery cleanup could not be confirmed."); return; }
        setPendingActivation(null); setFinalizationPromptOpen(false); setMessage(isRejectedLinkedSetup(data) ? linkedSetupRejectionMessage(data.code) : "Events were not finalized. Review the saved draft and try again."); return;
      }
      if (response.status === 409 && isRejectedSetupActivation(data)) {
        if(data.code==='idempotency_conflict'){setActivationRecoveryBlocked(true);try{const marker=JSON.stringify({operationId:envelope.request.idempotencyKey});setAppRecoveryItem(sessionStorage,`${activationStorageKey}:blocked`,marker);if(sessionStorage.getItem(`${activationStorageKey}:blocked`)!==marker)throw new Error('marker');setMessage("Finalization conflicted. The exact original request remains saved; do not retry it blindly.");}catch{setMessage("Finalization conflicted. The request remains saved but its warning could not be stored; keep this tab open.");}return;}
        sessionStorage.removeItem(activationStorageKey);if(sessionStorage.getItem(activationStorageKey)!==null){setActivationRecoveryBlocked(true);setMessage("Finalization was rejected, but recovery cleanup could not be confirmed. Keep this tab open.");return;}setPendingActivation(null); await load();if(!owned())return; setMessage(data.code === "schedule_revision_required" || data.code === "declaration_pins_changed" || data.code === "declaration_pins_required" ? "Review current event prize declarations, then check them again before finalizing." : data.code === "already_activated" ? "All events are already finalized and registration is open." : data.code === "missing_state_territory" ? "Select the tournament State/Territory, save the draft, and then finalize the events." : "Events were not finalized. Review the saved draft and try again."); return; }
      setMessage("Finalization is unresolved. Retry the exact request when the connection is available.");
    } catch { if(owned())setMessage("Finalization is unresolved. Retry the exact request when the connection is available."); } finally { if(owned()){inFlight.current = false; setBusy(false);} }
  }
  async function checkDeclarations(): Promise<DeclarationActivationPin[] | null> {
    if (!payload || !revisionId || dirty || pending || pendingActivation || declarationDirtyRows.current.size || declarationCheckFlight.current) return null;
    const pin = currentDeclarationPin, epoch = declarationEpoch.current, expectedRevision = revisionId, expectedVersion = version;
    declarationCheckFlight.current = true; setDeclarationChecking(true);
    try {
      const capabilityResponse = await fetch(`/api/v1/tournaments/${tournamentId}/setup/activation/capability`, { credentials: "same-origin", cache: "no-store" });
      const capability: unknown = capabilityResponse.ok ? await capabilityResponse.json() : null;
      if (!capability || typeof capability !== "object" || Array.isArray(capability) || Object.keys(capability).sort().join(',') !== 'available,hasV2Bindings,protocol'
        || (capability as Record<string, unknown>).available !== true || (capability as Record<string, unknown>).protocol !== 'event-prize-pins-v1' || typeof (capability as Record<string, unknown>).hasV2Bindings !== 'boolean') return null;
      const setupResponse = await fetch(`/api/v1/tournaments/${tournamentId}/setup`, { credentials: "same-origin", cache: "no-store" });
      const setupData: unknown = setupResponse.ok ? await setupResponse.json() : null;
      if (!setupData || typeof setupData !== "object" || !("workspace" in setupData) || !isSetupWorkspace(setupData.workspace)
        || setupData.workspace.current?.revisionId !== expectedRevision || setupData.workspace.current?.version !== expectedVersion) return null;
      const pins = await readEventPrizeDeclarationPins({ actorId, tournamentId, events: payload.events, allowLinkedEvents: linkedReady, readRecovery: key => sessionStorage.getItem(key),
        fetchWorkspace: async row => { const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup/event-prize-declarations/${row}`, { credentials: "same-origin", cache: "no-store" }); return response.ok ? response.json() : null; } });
      const now = declarationState.current;
      return pins && now.pin === pin && !now.dirty && !now.pending && !now.pendingActivation && declarationEpoch.current === epoch && declarationDirtyRows.current.size === 0 ? pins : null;
    } catch { return null; }
    finally { declarationCheckFlight.current = false; setDeclarationChecking(false); }
  }
  async function reviewDeclarations() {
    setDeclarationPin(""); setReviewedDeclarationPins(null);
    const pins = await checkDeclarations();
    if (pins) { setDeclarationPin(currentDeclarationPin); setReviewedDeclarationPins(pins); setMessage("Saved event prize declarations are current. Financial accounting is not finalized."); }
    else setMessage("Event declarations could not be verified. Save each current declaration and resolve any retained work before finalizing.");
  }
  function startActivation() { if(eventPrizeSettingsV1Enabled&&!prizeConfigured){setMessage("Save complete new Playoff settings for every Main and Consolation before finalizing. This path currently supports Standard Singles events; historical declarations remain preserved.");return;} if ((multiEventDeclarationPath && !declarationsReady) || scheduleBlocksActivation || !revisionId || version < 1 || dirty || busy || activationRecoveryBlocked || declarationChecking || pending || pendingActivation || (linkedReady ? !counts.main || !savedLinks?.complete || savedLinks.setupRevisionId !== revisionId || savedLinks.setupVersion !== version || !validateSetupEventLinks(payload?.events ?? [],linkChoices).complete : counts.main !== 1)) return; if(eventPrizeSettingsV1Enabled){prizeRuleEvidenceRef.current=null;setPrizeRuleReady({owner:settingsOwner,pin:prizeReviewPin,ready:false,reviews:null});} setFinalizationPromptOpen(true); }
  async function confirmActivation() {
    if(eventPrizeSettingsV1Enabled){await confirmPrizeRegistration();return;}
    if ((multiEventDeclarationPath && !declarationsReady) || scheduleBlocksActivation || !revisionId || version < 1 || dirty || busy || activationRecoveryBlocked || declarationChecking || pending || pendingActivation || (linkedReady ? !counts.main || !savedLinks?.complete || savedLinks.setupRevisionId !== revisionId || savedLinks.setupVersion !== version || !validateSetupEventLinks(payload?.events ?? [],linkChoices).complete : counts.main !== 1)) return;
    if (multiEventDeclarationPath) {
      const fresh = await checkDeclarations();
      if (!fresh || !reviewedDeclarationPins || JSON.stringify(fresh) !== JSON.stringify(reviewedDeclarationPins)) {
        setDeclarationPin(""); setReviewedDeclarationPins(null); setFinalizationPromptOpen(false); setMessage("Event declarations or setup changed. Check the saved declarations again before finalizing."); return;
      }
    }
    let freshHash: string | null = null;
    if (linkedReady) {
      try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup/linked`, {credentials:"same-origin",cache:"no-store"}); const value: unknown = response.ok ? await response.json() : null; if (!savedLinks || !isSetupEventLinksWorkspace(value) || !linkedSnapshotMatches(value.current,savedLinks) || !value.current?.complete) throw new Error("changed"); freshHash=value.current.associationHash; }
      catch {setFinalizationPromptOpen(false);setMessage("The saved event associations changed or could not be verified. Refresh before finalizing.");return;}
    }
    if (declarationState.current.pin !== currentDeclarationPin || declarationState.current.dirty || declarationState.current.pending || declarationState.current.pendingActivation) { setFinalizationPromptOpen(false); setMessage("The setup changed while finalization was being checked. Save and review it again."); return; }
    setFinalizationPromptOpen(false); const request: SetupActivationRequest = { setupRevisionId: revisionId, expectedVersion: version, confirmed: true, idempotencyKey: crypto.randomUUID(), ...(multiEventDeclarationPath && reviewedDeclarationPins?.length ? { declarationPins: reviewedDeclarationPins } : {}) }; const envelope: PendingActivation = freshHash ? {kind:"tournament-activation-linked-v1",request,associationHash:freshHash} : {kind:"tournament-activation",request}; if (!storePending(activationStorageKey, envelope)) { setMessage("This browser cannot safely retain the finalization request for recovery."); return; } void activate(envelope);
  }
  async function overrideSanctioningFeeRate(request: SanctioningFeeRateOverrideRequest) {
    if (rateOverrideBusy || busy) return;
    setRateOverrideBusy(true); setMessage("Recording the ACC Sanctioning Fee rate change…");
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/sanctioning-fee-rate`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok && isSanctioningFeeRateOverrideResult(data, request)) { await load(); setMessage("ACC Sanctioning Fee rate change recorded."); return; }
      setMessage(sanctioningFeeRateRejectionMessage(data && typeof data === "object" ? (data as Record<string, unknown>).code : null));
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
  function addAmendmentEvent(kind: "consolation" | "satellite") { if (amendmentBindingMode !== "legacy" || !payload || !activated || pendingAmendment || busy || activationState.events.length + amendmentEvents.length >= 32) return; if (kind === "consolation" && (activationState.events.some((event) => event.eventType === "consolation") || amendmentEvents.some((event) => event.eventKind === "consolation"))) return; setAmendmentEvents((events) => [...events, defaultEvent(kind, payload.startsAt, payload.timezone)]); }
  async function amend(envelope: PendingAmendment) {
    const owner=settingsOwner,owned=()=>settingsOwnerRef.current===owner;if(!owned())return;
    if (inFlight.current || amendmentBindingMode !== "legacy") return; inFlight.current = true; setBusy(true); setPendingAmendment(envelope); setMessage("Adding the new tournament events…");
    try { const response = await fetch(`/api/v1/tournaments/${tournamentId}/setup/amendments`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope.request) }); const data: unknown = await response.json().catch(() => null);if(!owned())return;
      if (response.ok && isSetupAmendmentResult(data, envelope.request)) { clearPending(amendmentStorageKey); setPendingAmendment(null); setAmendmentEvents([]); await load();if(!owned())return; setMessage(`${data.addedEventCount} new tournament event${data.addedEventCount === 1 ? "" : "s"} added successfully.`); return; }
      if (response.status === 409 && (isLegacySideRequestUnbound(data) || isSidePoolRequestConflict(data))) { const reason = isLegacySideRequestUnbound(data) ? "unbound" : "conflict"; const retained = retainSideRecoveryBlock(amendmentStorageKey, envelope.request.operationId, reason); const text=sideRecoveryBlockMessage(reason); setLegacySideRequestBlocked(true); setMessage(retained ? text : `${text} Keep this tab open because the warning could not be saved.`); return; }
      if (response.status === 409 && isRejectedSetupAmendment(data)) { clearPending(amendmentStorageKey); setPendingAmendment(null); await load();if(!owned())return; setMessage(data.code === "stale_setup_revision" ? "Another setup change was saved first. Review the current events before adding yours again." : "The new events were not added. Review the event details and current setup."); return; }
      setMessage("The event addition is unresolved. Retry the exact request when the connection is available.");
    } catch { if(owned())setMessage("The event addition is unresolved. Retry the exact request when the connection is available."); } finally { if(owned()){inFlight.current = false; setBusy(false);} }
  }
  function startAmendment() { if (amendmentBindingMode !== "legacy" || !activated || busy || pendingAmendment || amendmentEvents.length === 0) return; if (Object.keys(amendmentPayoutValidityRef.current).length > 0) { setMessage("Complete each new-event payout selection before adding these events."); return; } const request = { expectedSetupRevisionId: activationState.setupRevisionId, expectedSetupVersion: activationState.setupVersion, events: amendmentEvents, operationId: crypto.randomUUID() }; if (!(sidePoolTypesReady ? isSetupAmendmentRequest(request) : isRetainedSetupAmendmentRequest(request) && request.events.every(isLegacySideSetupEvent))) { setMessage("Complete every required new-event field before adding it."); return; } const envelope: PendingAmendment = { kind: "tournament-setup-amendment", request }; if (!storePending(amendmentStorageKey, envelope)) { setMessage("This browser cannot safely retain the event addition for recovery."); return; } void amend(envelope); }
  if (!payload || (eventSettingsV3Enabled&&!settingsReady)) return <div><p className="auth-note" role="status">{message}</p><button type="button" className="secondary" disabled={busy} onClick={() => setLoadAttempt(value => value + 1)}>Retry setup</button></div>;
  const savedTime = savedStamp ? formatSetupSavedAt(savedStamp.at, savedStamp.timezone) : null;
  const saveState = pending ? (busy ? "saving" : "unresolved") : saveOutcome === "rejected" ? "rejected" : dirty ? "dirty" : saveOutcome === "confirmed" ? "confirmed" : "loaded";
  const saveNotice = (position: "events" | "officials") => <div id={position === "events" ? "setup-draft-save-status" : "setup-draft-save-status-officials"} className="setup-save-status" data-state={saveState} role={position === "events" ? "status" : undefined} aria-live={position === "events" ? "polite" : "off"} aria-atomic={position === "events" ? "true" : undefined}>
    <strong>{saveState === "saving" ? "Saving draft…" : saveState === "unresolved" ? "Save not confirmed. Keep this request and retry it exactly." : saveState === "rejected" ? "Draft was not saved. Review the setup error." : saveState === "dirty" ? "Unsaved changes — save this draft before leaving." : saveState === "confirmed" ? `Saved successfully — setup version ${version}.` : "Last saved setup is loaded."}</strong>
    {savedStamp ? <span>Last verified save: version {savedStamp.version}, {savedTime ? <time dateTime={savedStamp.at}>{savedTime}</time> : "save date and time unavailable"}.</span> : <span>No saved setup has been verified.</span>}
  </div>;
  const saveEventsDraft = () => { if (pending) void save(pending); else startSave(); };
  const draftSaveDisabled = pending ? busy || activationDraftLocked || legacySideRequestBlocked || settingsRecoveryBlocked || (pending.kind==="tournament-event-settings-v3"&&!eventSettingsV3Enabled)||(pending.kind==="tournament-event-prize-v1"&&!eventPrizeSettingsV1Enabled) : draftEditingDisabled || !dirty || Object.keys(invalidPayouts).length > 0;
  const checkSavedSettings = () => { if(pending?.kind==="tournament-event-prize-v1")void savePrizeSettings(pending,true); else if(pending?.kind==="tournament-event-settings-v3")void saveSettingsV3(pending,true); };
  const draftSaveControls = (position: "events" | "officials") => <div className="setup-draft-save" data-testid={`setup-draft-save-${position}`}><button type="button" className="primary" aria-describedby={position === "events" ? "setup-draft-save-status" : "setup-draft-save-status-officials"} disabled={draftSaveDisabled} onClick={saveEventsDraft}>{pending ? busy ? "Saving tournament setup." : "Retry exact saved request" : "Save All Events Draft"}</button>{saveNotice(position)}{(pending?.kind==="tournament-event-settings-v3"||pending?.kind==="tournament-event-prize-v1")&&<button type="button" className="secondary" disabled={busy||settingsRecoveryBlocked||(pending.kind==="tournament-event-prize-v1"?!eventPrizeSettingsV1Enabled:!eventSettingsV3Enabled)} onClick={checkSavedSettings}>Check Saved Playoff Settings Request</button>}{pending?.kind==='tournament-event-prize-v1'&&!eventPrizeSettingsV1Enabled&&<p role="status">This retained request needs the new Playoff settings mode. It has not been cleared or sent through an older writer.</p>}{prizeResolution?.owner===settingsOwner&&position==='events'&&<section role={prizeResolution.confirm?'alertdialog':undefined} aria-modal={prizeResolution.confirm?'true':undefined} aria-label="Resolve Retained Playoff Request"><p>{prizeResolution.proof.outcome==='confirmed_rejected'?'The original rejection is confirmed in its immutable record. Removing this local request discards its unsaved changes; saved tournament records remain unchanged.':prizeResolution.proof.outcome==='unapplied_stale'?'The old request was not applied. Discarding it removes its unsaved local changes; keep any details you need before continuing.':'The original save is confirmed in history, and a newer draft exists. Its saved records will be preserved.'}</p>{prizeResolution.confirm?<><p>Remove only this resolved request from this browser and load the latest saved draft?</p><button type="button" className="secondary" disabled={busy} onClick={()=>setPrizeResolution(p=>p?.owner===settingsOwner?{...p,confirm:false}:p)}>Keep Request</button><button type="button" className="primary" disabled={busy} onClick={()=>void resolvePrizePending()}>Confirm and Load Latest Draft</button></>:<button type="button" className="secondary" disabled={busy} onClick={()=>setPrizeResolution(p=>p?.owner===settingsOwner?{...p,confirm:true}:p)}>Review Recovery Resolution</button>}</section>}</div>;
  return <section className="policy-settings setup-workspace"><h2>Tournament details</h2>{eventSettingsV3Enabled&&<p className="auth-note" role="status">Versioned Playoff draft mode. Activation remains blocked until the operational provider and financial-source contracts are verified. Existing declarations are retained; no legacy save fallback is allowed.</p>}<p className="auth-note">Primary director: {primaryDirectorName}</p>
    {activationDraftLocked && !activated && <p className="auth-note" role="status">Draft editing and saving are locked while finalization recovery is unresolved. Keep the retained finalization request intact.</p>}
    <fieldset disabled={draftEditingDisabled}><div className="setup-grid setup-details-grid">
      <label className="setup-span-6">Tournament Name<input required maxLength={200} value={payload.tournamentName} onChange={(e) => setPayload({ ...payload, tournamentName: e.target.value })} /></label>
      <label className="setup-span-6">Venue Name<input required autoComplete="organization" maxLength={160} value={payload.venueName} onChange={(e) => { const venueName = e.target.value; setPayload({ ...payload, venueName, venue: venueProjection(venueName, payload.venueStreet, payload.venuePostalCode) }); }} /></label>
      <label className="setup-span-6">Venue Street Address<input required autoComplete="street-address" maxLength={240} value={payload.venueStreet} onChange={(e) => { const venueStreet = e.target.value; setPayload({ ...payload, venueStreet, venue: venueProjection(payload.venueName, venueStreet, payload.venuePostalCode) }); }} /></label>
      <label className="setup-span-2">Venue City<input required autoComplete="address-level2" maxLength={160} value={payload.city} onChange={(e) => setPayload({ ...payload, city: e.target.value })} /></label>
      <label className="setup-span-2">Venue State<select required autoComplete="address-level1" value={payload.stateTerritory} onChange={(e) => { const stateTerritory = e.target.value; setPayload({ ...payload, stateTerritory, timezone: defaultTimeZoneForStateTerritory(stateTerritory) }); }}><option value="">Select</option>{tournamentStateTerritories.map((stateTerritory) => <option key={stateTerritory} value={stateTerritory}>{stateTerritory}</option>)}</select></label>
      <label className="setup-span-2">Venue ZIP<input required autoComplete="postal-code" inputMode="numeric" maxLength={20} value={payload.venuePostalCode} onChange={(e) => { const venuePostalCode = e.target.value; setPayload({ ...payload, venuePostalCode, venue: venueProjection(payload.venueName, payload.venueStreet, venuePostalCode) }); }} /></label>
      <TournamentDateFields startsAt={payload.startsAt} endsAt={payload.endsAt} plannedDateCarriedForward={creationSeedActive && !revisionId} onChange={(dates) => setPayload({ ...payload, ...dates })} />
      <label className="setup-span-4">Time Zone<select required value={payload.timezone} onChange={(e) => setPayload({ ...payload, timezone: e.target.value })}>{tournamentTimeZones.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}</select><span className="field-help">Handles daylight saving time where applicable.</span></label>
      <fieldset className="setup-director-info setup-span-12"><legend>Tournament Director Information (shown to players)</legend><p className="field-help setup-director-help">Use the information players should see for this tournament. It is separate from private account information.</p><div className="setup-director-fields"><label className="setup-director-first">First Name<input required maxLength={80} autoComplete="given-name" value={payload.tournamentDirectorFirstName} onChange={(e) => { const tournamentDirectorFirstName = e.target.value; setPayload({ ...payload, tournamentDirectorFirstName, tournamentDirectorPublicName: directorProjection(tournamentDirectorFirstName, payload.tournamentDirectorLastName) }); }} /></label><label className="setup-director-last">Last Name<input required maxLength={80} autoComplete="family-name" value={payload.tournamentDirectorLastName} onChange={(e) => { const tournamentDirectorLastName = e.target.value; setPayload({ ...payload, tournamentDirectorLastName, tournamentDirectorPublicName: directorProjection(payload.tournamentDirectorFirstName, tournamentDirectorLastName) }); }} /></label><label className="setup-director-phone">Phone<TournamentPhoneInput value={payload.tournamentContactPhone} onChange={(tournamentContactPhone) => setPayload({ ...payload, tournamentContactPhone })} /></label><label className="setup-director-email">Email<input type="email" autoComplete="email" maxLength={320} value={payload.tournamentContactEmail} onChange={(e) => setPayload({ ...payload, tournamentContactEmail: e.target.value })} /></label><label className="setup-director-mailing">Mailing Address for Correspondence<span id="tournament-mailing-address-help" className="field-help">*Note: This address will be visible to players.</span><textarea aria-describedby="tournament-mailing-address-help" maxLength={500} value={payload.tournamentMailingAddress} onChange={(e) => setPayload({ ...payload, tournamentMailingAddress: e.target.value })} /></label></div></fieldset>
    </div></fieldset>
    {!activated && !tournamentDetailsSaved ? <section className="setup-details-save" aria-labelledby="save-tournament-details-title"><h3 id="save-tournament-details-title">Save these details before setting up events</h3><p>The Tournament Events section stays locked until these details are saved.</p>{tournamentDetailsIssues.length > 0 ? <p className="error-text" role="status">Still required or invalid: {tournamentDetailsIssues.join(", ")}.</p> : <p className="auth-note" role="status">All required tournament details are ready to save.</p>}{pending ? <button type="button" className="primary" disabled={busy || activationDraftLocked || legacySideRequestBlocked} onClick={() => void save(pending)}>{busy ? "Saving tournament details." : "Retry Save Tournament Details"}</button> : <button type="button" className="primary" disabled={draftEditingDisabled || !dirty || !tournamentDetailsReady} onClick={startTournamentDetailsSave}>Save Tournament Details &amp; Continue</button>}</section> : null}
    {!activated ? <><div className={`setup-heading setup-events-heading${tournamentDetailsSaved ? "" : " setup-heading-locked"}`}><div className="setup-event-heading-row"><h2>Tournament Events</h2>{linkedReady ? (!counts.main ? <button type="button" className="secondary" disabled={!tournamentDetailsSaved || draftEditingDisabled || payload.events.length >= 32} onClick={() => add("main")}>Add Main Event</button> : null) : <EventAddActions position="above" counts={counts} count={payload.events.length} linkedReady={linkedReady} disabled={!tournamentDetailsSaved || draftEditingDisabled} add={add} />}</div><p>{tournamentDetailsSaved ? "Click Add Main Event to enter its event name, fees, date and time, included items, and Q-Pools. Add Consolation or Satellite events when needed. Two-person Traditional Doubles and Canadian Doubles support shared Digital or Paper team scorecards." : "Save Tournament Details & Continue above to unlock event setup."}</p></div>
      <fieldset disabled={!tournamentDetailsSaved || draftEditingDisabled} aria-describedby={!tournamentDetailsSaved ? "tournament-events-locked-note" : undefined}><legend className="sr-only">Configured tournament events</legend>{(linkedReady ? canonicalGuidedEvents(payload.events,linkChoices) : payload.events).filter(event => !linkedReady || (!["satellite", "custom"].includes(event.eventKind) && (event.eventKind !== "consolation" || !linkChoices.some(choice => choice.consolationClientRowIds.some(id => id.toLowerCase() === event.clientRowId.toLowerCase()))))).map(event => {
        const editor = (event: SetupEvent) => <EventEditor key={event.clientRowId} event={event} playoffEnabled={settingsReady||prizeReady} prizeEnabled={prizeReady} prizeChoice={prizeReady&&prizeState?prizeChoicesForPayloadV1([event],prizeState.prizes)[0]:undefined} onPrizeChoiceChange={(choice,expected)=>{if(inFlight.current||draftEditingDisabled||!prizeReady||!prizeState||settingsOwnerRef.current!==settingsOwner)return;setPrizeState(previous=>{if(previous?.owner!==settingsOwner||canonicalEventSettingsClientV3(previous.workspace.base)!==canonicalEventSettingsClientV3(prizeState.workspace.base))return previous;const current=prizeChoicesForPayloadV1([event],previous.prizes)[0];if(expected==='preserve_historical'?current?.mode!=='preserve_historical':expected&&(current?.mode!=='proposed_v2'||canonicalEventSettingsClientV3(current.draft)!==canonicalEventSettingsClientV3(expected)))return previous;return{...previous,prizes:{...previous.prizes,[choice.eventClientRowId]:choice}};});}} playoffChoice={prizeReady&&prizeState?eventSettingsChoicesForPayloadV3([event],prizeState.settings)[0]:settingsReady?eventSettingsChoicesForPayloadV3([event],settingsState.choices)[0]:undefined} onPlayoffChoiceChange={choice=>{if(inFlight.current||draftEditingDisabled)return;if(prizeReady&&prizeState){setPrizeState(previous=>previous?.owner===settingsOwner&&canonicalEventSettingsClientV3(previous.workspace.base)===canonicalEventSettingsClientV3(prizeState.workspace.base)&&canonicalEventSettingsClientV3(eventSettingsChoicesForPayloadV3([event],previous.settings)[0])===canonicalEventSettingsClientV3(eventSettingsChoicesForPayloadV3([event],prizeState.settings)[0])?{...previous,settings:{...previous.settings,[choice.eventClientRowId]:choice}}:previous);return;}if(!settingsReady)return;setSettingsState(previous=>previous?.owner===settingsOwner?{...previous,choices:{...previous.choices,[choice.eventClientRowId]:choice}}:previous);}} sidePoolTypesReady={sidePoolTypesReady} onPayoutValidityChange={onPayoutValidityChange} removeBlocked={linkedReady && event.eventKind === "main" && mainRemovalBlocked(event.clientRowId,payload.events,linkChoices)} number={(linkedReady ? canonicalGuidedEvents(payload.events,linkChoices) : payload.events).indexOf(event) + 1} update={(value) => updateEvent(event.clientRowId, value)} remove={() => { if (!tournamentDetailsSaved || draftEditingDisabled || (linkedReady && event.eventKind === "main" && mainRemovalBlocked(event.clientRowId,payload.events,linkChoices))) return; setPayload({ ...payload, events: payload.events.filter(candidate => candidate.clientRowId !== event.clientRowId) }); const affected = event.eventKind === "consolation" ? linkChoices.filter(choice => choice.consolationClientRowIds.length === 1 && choice.consolationClientRowIds[0].toLowerCase() === event.clientRowId.toLowerCase()).map(choice => choice.mainClientRowId) : []; setPendingYesMainIds(previous => [...new Set([...previous.filter(id => id.toLowerCase() !== event.clientRowId.toLowerCase()), ...affected])]); setLinkChoices(previous => previous.filter(choice => choice.mainClientRowId.toLowerCase() !== event.clientRowId.toLowerCase()).flatMap(choice => { const children = choice.consolationClientRowIds.filter(id => id.toLowerCase() !== event.clientRowId.toLowerCase()); return choice.consolationClientRowIds.length > 0 && children.length === 0 ? [] : [{...choice,consolationClientRowIds:children}]; })); }} />;
        const selected = linkChoices.find(choice => choice.mainClientRowId.toLowerCase() === event.clientRowId.toLowerCase());
        return <div key={event.clientRowId}>{editor(event)}{linkedReady && event.eventKind === "main" && <><MainConsolationChoice main={event} events={payload.events} choice={selected} pendingYes={pendingYesMainIds.some(id => id.toLowerCase() === event.clientRowId.toLowerCase())} canAddConsolation={payload.events.length < 32} disabled={draftEditingDisabled} assignedConsolationIds={linkChoices.filter(choice => choice.mainClientRowId.toLowerCase() !== event.clientRowId.toLowerCase()).flatMap(choice => choice.consolationClientRowIds)} onConfirmNo={(mainId,childIds) => {
 if (!tournamentDetailsSaved || draftEditingDisabled) return false;
 const owned = linkChoices.find(item => item.mainClientRowId.toLowerCase() === mainId.toLowerCase())?.consolationClientRowIds ?? [];
 const removeIds = new Set(childIds.map(id => id.toLowerCase()));
 if (owned.length !== removeIds.size || owned.some(id => !removeIds.has(id.toLowerCase())) || childIds.some(id => !payload.events.some(item => item.eventKind === "consolation" && item.clientRowId.toLowerCase() === id.toLowerCase()))) { setMessage("The draft changed. Review the current events before choosing No."); return false; }
 setPayload(previous => previous ? {...previous,events:previous.events.filter(item => !(item.eventKind === "consolation" && removeIds.has(item.clientRowId.toLowerCase())))} : previous);
 setLinkChoices(previous => [...previous.filter(item => item.mainClientRowId.toLowerCase() !== mainId.toLowerCase()),{mainClientRowId:mainId,consolationClientRowIds:[]}]);
 return true;
}} onPendingYesChange={isPending => setPendingYesMainIds(previous => isPending ? [...new Set([...previous,event.clientRowId])] : previous.filter(id => id.toLowerCase() !== event.clientRowId.toLowerCase()))} onChange={choice => { if (draftEditingDisabled) return; setLinkChoices(previous => [...previous.filter(item => item.mainClientRowId.toLowerCase() !== choice.mainClientRowId.toLowerCase()),choice]); }} onAddConsolation={mainId => { if (!tournamentDetailsSaved || draftEditingDisabled || payload.events.length >= 32) return; const added = defaultEvent("consolation", payload.startsAt, payload.timezone); const previousIds = linkChoices.find(item => item.mainClientRowId.toLowerCase() === mainId.toLowerCase())?.consolationClientRowIds ?? []; const mainIndex = payload.events.findIndex(item => item.clientRowId === mainId); const insertion = Math.max(mainIndex, ...payload.events.map((item,index) => previousIds.some(id => id.toLowerCase() === item.clientRowId.toLowerCase()) ? index : mainIndex)) + 1; setPayload({...payload,events:[...payload.events.slice(0,insertion),added,...payload.events.slice(insertion)]}); setLinkChoices(previous => { const old = previous.find(item => item.mainClientRowId.toLowerCase() === mainId.toLowerCase()); return [...previous.filter(item => item.mainClientRowId.toLowerCase() !== mainId.toLowerCase()),{mainClientRowId:mainId,consolationClientRowIds:[...(old?.consolationClientRowIds ?? []),added.clientRowId]}]; }); }} >{selected?.consolationClientRowIds.map(id => {const child=payload.events.find(item => item.clientRowId.toLowerCase() === id.toLowerCase() && item.eventKind === "consolation");return child ? editor(child) : null;})}</MainConsolationChoice></>}</div>;
      })}</fieldset>
      {linkedReady ? <><fieldset disabled={!tournamentDetailsSaved || draftEditingDisabled}><legend className="sr-only">Satellite and other events</legend>{payload.events.filter(event => ["satellite", "custom"].includes(event.eventKind)).map(event => <EventEditor key={event.clientRowId} event={event} sidePoolTypesReady={sidePoolTypesReady} onPayoutValidityChange={onPayoutValidityChange} number={(linkedReady ? canonicalGuidedEvents(payload.events,linkChoices) : payload.events).indexOf(event) + 1} update={value => updateEvent(event.clientRowId,value)} remove={() => {if (tournamentDetailsSaved && !draftEditingDisabled) setPayload({...payload,events:payload.events.filter(item => item.clientRowId !== event.clientRowId)});}} />)}</fieldset>{!!counts.main && validateSetupEventLinks(payload.events,linkChoices).complete && pendingYesMainIds.length === 0 && <div className="setup-actions" data-testid="setup-satellite-add"><button type="button" className="secondary" disabled={!tournamentDetailsSaved || draftEditingDisabled || payload.events.length >= 32} onClick={() => add("satellite")}>Add Satellite Event</button></div>}</> : tournamentDetailsSaved && payload.events.length > 0 ? <EventAddActions position="below" counts={counts} count={payload.events.length} linkedReady={linkedReady} disabled={draftEditingDisabled} add={add} /> : null}
      {!tournamentDetailsSaved ? <p id="tournament-events-locked-note" className="auth-note">Tournament Events is locked until the tournament details are saved.</p> : payload.events.length === 0 ? <p className="auth-note">No events are configured. You can save this empty draft; add a Main Event before finalizing.</p> : null}</> : null}
    {!activated && tournamentDetailsSaved ? draftSaveControls("events") : null}
    {tournamentDetailsSaved ? <><SetupOfficialSummaries tournamentId={tournamentId} canManage={isPrimaryDirector} />{!activated ? draftSaveControls("officials") : null}<SanctioningFeePanel eligibleCounts={sanctioningFee ? { main: sanctioningFee.mainEligibleParticipantCount, consolation: sanctioningFee.consolationEligibleParticipantCount } : null} mainRateCents={effectiveMainRateCents} consolationRateCents={effectiveConsolationRateCents} runningTotalCents={sanctioningFeeRunningTotalCents} lastUpdatedAt={sanctioningFeeLastUpdatedAt} refreshing={sanctioningFeeRefreshing} busy={busy || !!pending || rateOverrideBusy} canAdjust={!pending} unavailableReason={pending ? "A setup save is waiting to be confirmed. Retry or resolve that save first, then the rate can be adjusted." : null} onRefresh={() => void refreshSanctioningFee()} onApply={overrideSanctioningFeeRate} /></> : null}
    <p role="status" aria-live="polite" className={message.includes("unavailable") || message.includes("unresolved") || message.includes("Complete") ? "error-text" : "auth-note"}>{message}</p>
    {pendingActivation?.kind==='tournament-prize-activation-v1'&&<section className="setup-amendment" aria-label="Registration Request Recovery"><p>The exact registration request remains retained until its complete operation and current event list are verified.</p><button type="button" className="secondary" disabled={busy||!eventPrizeSettingsV1Enabled||activationRecoveryBlocked} onClick={()=>void activatePrize(pendingActivation,true)}>Check Saved Registration Request</button><button type="button" className="secondary" disabled={busy||!eventPrizeSettingsV1Enabled||activationRecoveryBlocked} onClick={()=>void activatePrize(pendingActivation)}>Retry Exact Registration Request</button>{!eventPrizeSettingsV1Enabled&&<p>Use the new Playoff settings mode to recover this request. Nothing has been cleared or sent through an older finalizer.</p>}{rejectedPrizeActivation?.owner===settingsOwner&&<div role={rejectedPrizeActivation.confirm?'alertdialog':undefined} aria-label="Resolve Rejected Registration Request"><p>The matching operation records a rejection without activating events. Its server history will be preserved.</p>{rejectedPrizeActivation.confirm?<><p>Remove only this rejected local request and load the latest saved setup?</p><button type="button" disabled={busy} onClick={()=>setRejectedPrizeActivation(p=>p?.owner===settingsOwner?{...p,confirm:false}:p)}>Keep Request</button><button type="button" disabled={busy} onClick={()=>void resolveRejectedPrizeActivation()}>Confirm Rejection Resolution</button></>:<button type="button" disabled={busy} onClick={()=>setRejectedPrizeActivation(p=>p?.owner===settingsOwner?{...p,confirm:true}:p)}>Review Rejection Resolution</button>}</div>}</section>}
    {!activationStatusAvailable ? <button type="button" className="secondary" disabled={busy} onClick={() => void load()}>Refresh finalization status</button> : null}
    {!activated && finalizationPromptOpen ? <section className="setup-amendment" role="alertdialog" aria-modal="true" aria-labelledby="finalize-events-title"><h2 id="finalize-events-title">Open registration for all current events?</h2><p>Please confirm you intend to open registration for these events. Event details will no longer be editable.</p><ul>{payload.events.map((event)=><li key={event.clientRowId}>{finalizationEventLine(event)}</li>)}</ul>{eventPrizeSettingsV1Enabled&&prizeState?.workspace.settings.state==='present'&&revisionId&&<><p className="auth-note">Review each Main and Consolation&apos;s rule context below. This opens registration only. New-policy playoff execution and payout accounting remain unavailable; saving a reference does not verify external approval.</p><EventPrizeRuleReviewV1 actorId={actorId} tournamentId={tournamentId} setupRevisionId={revisionId} setupVersion={version} settingsSnapshotId={prizeState.workspace.settings.id} settingsDigest={prizeState.workspace.settings.digest} onReadyReviews={reviews=>{if(settingsOwnerRef.current!==settingsOwner)return;prizeRuleEvidenceRef.current={owner:settingsOwner,pin:prizeReviewPin,reviews};setPrizeRuleReady(p=>p?.owner===settingsOwner&&p.pin===prizeReviewPin&&canonicalEventSettingsClientV3(p.reviews)===canonicalEventSettingsClientV3(reviews)?p:{owner:settingsOwner,pin:prizeReviewPin,ready:reviews!==null,reviews});}}/></>}<div className="setup-actions"><button type="button" className="secondary" disabled={declarationChecking||busy} onClick={()=>setFinalizationPromptOpen(false)}>Cancel</button><button type="button" className="primary" disabled={declarationChecking||busy||(eventPrizeSettingsV1Enabled&&!prizeReviewReady)} onClick={()=>void confirmActivation()}>Yes, Finalize &amp; Open Registration</button></div></section> : null}
    {payload.events.filter(() => prizeScheduleApplies).map(event => <PrizeScheduleClient key={`${event.clientRowId}-${version}-${activated}`} actorId={actorId} tournamentId={tournamentId} clientRowId={event.clientRowId} entryFeeCents={event.entryFeeCents} onBlockingChange={onScheduleBlockingChange} disabled={busy || dirty || !!pending || activationDraftLocked || payload.events.length !== 1 || event.gameCount !== 12 || event.formatCode !== "standard_singles"} />)}
    {multiEventDeclarationPath && !activated ? <><p className="auth-note" role="status">Check each saved prize declaration before opening registration. The exact reviewed versions are bound when events are finalized. This does not finalize accounting or record payments.</p>{payload.events.filter(event => (event.eventKind === "main" || event.eventKind === "consolation") && event.entryFeeCents > 0).map(event => <EventPrizeDeclarationClient key={`${event.clientRowId}-${version}`} actorId={actorId} tournamentId={tournamentId} clientRowId={event.clientRowId} eventName={event.displayName} disabled={draftEditingDisabled || dirty} onDraftChange={value => declarationDraftChanged(event.clientRowId, value)} />)}<button type="button" className="secondary" disabled={draftEditingDisabled || dirty || declarationDirtyCount > 0} onClick={() => void reviewDeclarations()}>Check event declarations</button>{declarationDirtyCount > 0 && <p>Unsaved declaration edits block this check. Save those edits, or reload to discard them before checking.</p>}{declarationsReady && <p>Saved event declarations are current for this draft.</p>}</> : null}
    <a className="guide-link" href={`/tournament/${tournamentId}/prize-schedules`}>Printable and player-visible prize schedules</a>
    {activated ? <>
      <section className="setup-activation-summary"><h2>All events are finalized; registration is open</h2><p>{eventPrizeSettingsV1Enabled?"Registration is open with the saved Playoff policy. New-policy playoff execution, payout accounting and post-finalization event amendments remain unavailable. This did not start play, charge anyone or publish results.":"These events are available for roster enrollment, seating, schedules, financials, and later Start Play. Finalizing opens registration; it does not start play, close registration, assign seats, charge anyone, or publish results."}</p><section className="setup-finalized-tournament-summary" aria-label="Saved tournament details"><h3>Saved tournament details</h3><dl><div><dt>Location</dt><dd>{payload.venueName || payload.venue}<br />{payload.venueStreet ? `${payload.venueStreet}, ` : ""}{payload.city}, {payload.stateTerritory} {payload.venuePostalCode}</dd></div><div><dt>Tournament Director</dt><dd>{payload.tournamentDirectorPublicName}</dd></div><div><dt>Time zone</dt><dd>{tournamentTimeZones.find((zone) => zone.value === payload.timezone)?.label ?? payload.timezone}</dd></div><div><dt>Schedule</dt><dd>{payload.startsAt.replace("T", " ")} to {payload.endsAt.replace("T", " ")}</dd></div></dl></section><ul>{activationState.events.map((event) => <li key={event.eventId}><strong>{activatedEventLine(event)}</strong> — {event.gameCount} games, {event.scoringMethod === "digital" ? "digital and paper scoring" : "paper scoring"}{event.scoringMethod === "manual" && ["doubles", "canadian_doubles"].includes(event.format) ? <button type="button" className="secondary" disabled={busy || teamUpgradeBusy} onClick={() => void enableTeamScoring(event.eventId)}>Enable Digital and Paper Team Scoring</button> : null}</li>)}</ul><a className="primary button-link registration-primary" href={`/tournament/${tournamentId}/registration`}>Create or manage registration QR code and URL</a></section>
      {isPrimaryDirector ? <section className="setup-amendment"><h2>Public registration contact</h2><p>Correct the name shown to players without reopening registration or changing finalized events.</p><label>Tournament Director Name (Shown to Players)<input required maxLength={160} autoComplete="name" value={publicDirectorDraft} onChange={(event) => setPublicDirectorDraft(event.target.value)} /></label><button type="button" className="secondary" disabled={publicContactBusy || !publicDirectorDraft.trim() || publicDirectorDraft.trim() === payload.tournamentDirectorPublicName.trim()} onClick={() => void correctPublicDirectorName()}>{publicContactBusy ? "Updating…" : "Update public Director name"}</button></section> : null}
      {!eventPrizeSettingsV1Enabled && <section className="setup-post-finalization"><h2>Post-finalization event administration</h2><p>Use only when necessary after registration opens. These tools do not start play, rewrite active event details, or erase records.</p><div className="setup-post-finalization-actions"><a className="secondary button-link" href={`/tournament/${tournamentId}/side-pools`}>Set Up Side Pools</a><a className="secondary button-link" href={`/tournament/${tournamentId}/event-changes`}>Exceptional Event Changes</a></div><section className="setup-amendment"><div className="setup-heading"><div><h3>Add a later event</h3><p>Add a Consolation or Satellite event without changing any active event.</p>{amendmentBindingMode === "v2" ? <p>Adding later events is unavailable until the reviewed declaration-pin amendment workflow is supported. Existing events and records remain unchanged.</p> : amendmentBindingMode === "unknown" ? <p>Later-event eligibility could not be verified. No event can be added until its declaration mode is available.</p> : null}</div><div className="setup-actions"><button type="button" className="secondary" disabled={amendmentBindingMode !== "legacy" || busy || !!pendingAmendment || activationState.events.some((event) => event.eventType === "consolation") || amendmentEvents.some((event) => event.eventKind === "consolation")} onClick={() => addAmendmentEvent("consolation")}>Add Consolation Event</button><button type="button" className="secondary" disabled={amendmentBindingMode !== "legacy" || busy || !!pendingAmendment || activationState.events.length + amendmentEvents.length >= 32} onClick={() => addAmendmentEvent("satellite")}>Add Satellite Event</button></div></div><fieldset disabled={amendmentBindingMode !== "legacy" || busy || !!pendingAmendment}><legend className="sr-only">New tournament events</legend>{amendmentEvents.map((event, index) => <EventEditor key={event.clientRowId} event={event} sidePoolTypesReady={sidePoolTypesReady} onPayoutValidityChange={onAmendmentPayoutValidityChange} number={activationState.events.length + index + 1} update={(value) => setAmendmentEvents((events) => events.map((candidate) => candidate.clientRowId === value.clientRowId ? value : candidate))} remove={() => setAmendmentEvents((events) => events.filter((candidate) => candidate.clientRowId !== event.clientRowId))} />)}</fieldset>{pendingAmendment ? <button type="button" className="primary" disabled={amendmentBindingMode !== "legacy" || busy || legacySideRequestBlocked} onClick={() => void amend(pendingAmendment)}>Retry Exact Event Addition</button> : amendmentEvents.length > 0 ? <button type="button" className="primary" disabled={amendmentBindingMode !== "legacy" || busy || amendmentEvents.length === 0 || Object.keys(invalidAmendmentPayouts).length > 0} onClick={startAmendment}>Add New Tournament Events</button> : null}</section></section>}
    </> : !pending && tournamentDetailsSaved ? <><p className="auth-note" role="status" hidden={!needsEventOrdering}>Save this draft to arrange each Main followed by its Consolation, then Satellite and other events.</p><p className="auth-note" role="status" hidden={!dirty}>You have unsaved setup changes. Press Save All Events Draft before leaving this page, including before adding a co-director or judge. Leaving now discards them.</p><p className="auth-note" role="status" hidden={!eventPrizeSettingsV1Enabled||prizeConfigured}>Save complete new Playoff settings for every Main and Consolation before finalizing. This registration path supports Standard Singles events; historical records remain preserved.</p><div className="setup-actions">{revisionId && (linkedReady ? !!counts.main : counts.main === 1) ? pendingActivation ? pendingActivation.kind==="tournament-prize-activation-v1"?null:<button type="button" className="primary" disabled={busy || activationRecoveryBlocked} onClick={() => void activate(pendingActivation)}>{busy ? "Finalizing events…" : "Retry Finalize & Open Registration"}</button> : <button type="button" className="primary" disabled={busy || activationRecoveryBlocked || declarationChecking || dirty || (multiEventDeclarationPath && !declarationsReady) || (linkedReady && (!savedLinks?.complete || savedLinks.setupRevisionId !== revisionId || savedLinks.setupVersion !== version)) || scheduleBlocksActivation || !activationStatusAvailable || (eventPrizeSettingsV1Enabled&&!prizeConfigured)} onClick={startActivation}>Finalize All Events / Open Registration</button> : null}</div></> : null}
  </section>;
}






























