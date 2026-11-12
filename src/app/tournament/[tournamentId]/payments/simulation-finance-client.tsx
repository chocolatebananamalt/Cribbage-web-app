"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { setAppRecoveryItem } from "../../../../lib/recovery-write-coordinator";
import { isProjectedSimulatedFinanceSelector } from "../../../../lib/api/simulated-finance-selector";
import { isSimulationRecovery, type SimulationRecovery } from "../../../../lib/api/simulated-finance-recovery";
import { isAcceptedSimulationResult } from "../../../../lib/api/multi-event-simulation-action";
import { buildSimulatedPoolReceipt, type ReceiptSelectorEvent } from "../../../../lib/api/simulated-finance-receipt";
import { buildSimulatedExpense, buildSimulatedClassification, simulatedDollars } from "../../../../lib/api/simulated-finance-expense";

type Pool = { kind: "q" | "side"; slot: number; name: string; definitionId: string; type: string | null; feeMinor: number; policyId: string | null; policyMethod: string | null; policyRatio: number | null };
type Participant = { participantId: string; rosterEntryId: string; name: string; status: string; receiptRecorded: boolean; elections: { policyId: string; electionId: string; version: number; elected: boolean }[] };
type Workspace = Omit<ReceiptSelectorEvent, "pools" | "participants"> & { eventName: string; financialClosed: boolean; anyReceiptRecorded: boolean; pools: Pool[]; participants: Participant[]; expenseReviewVersion: number; sanctioningAssessmentMinor: number | null; sources: { status: string; sourceDigest: string; blockers: string[]; expenses: { id: string; amountMinor: number; reason: string }[] } };
type State = { status: "blocked"; code: string } | ({ status: "available" } & Workspace);
const syntheticReason = (s: string) => `TEST ONLY SYNTHETIC: ${s.trim()}`;
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
function policy(pool: Pool): {method: string; ratio: number | null} | null {
  if (pool.kind === "q" && pool.type === "Equal (Pays All Equally)") return { method: "equal-paid-playoff-qualifiers-v2", ratio: null };
  const match = pool.kind === "q" ? /^Graduated \(1-in-([46])\)$/.exec(pool.type ?? "") : /^graduated-1-in-(4|6|8|10)$/.exec(pool.type ?? "");
  return match ? { method: "graduated-acc-weighted-largest-remainder-5usd-v2", ratio: Number(match[1]) } : null;
}
function policyTerms(pool: Pool): string {
  const terms = policy(pool);
  if (!terms) return "This pool type has no supported simulated policy yet.";
  if (terms.ratio === null) return "The simulated pool is divided equally among paid entrants who qualify for the playoffs. If none qualify, the simulation returns each paid entry. If equal shares are not whole $5 amounts, the preview is blocked.";
  return `The simulated pool pays ${terms.ratio === 4 ? "1 in 4" : terms.ratio === 6 ? "1 in 6" : terms.ratio === 8 ? "1 in 8" : "1 in 10"} paid entrants, ranked by game points, games won, then positive spread points. ${pool.kind === "side" ? "Side Pool eligibility has no playoff-qualifier cutoff." : "Paid nonqualifiers can receive a pool award."} Awards use whole $5 amounts; unresolved ties at a paid place block the preview.`;
}

/** Local simulation only; parent must show this only for an enrolled test mode. */
export default function SimulationFinanceClient({ actorId, tournamentId, events, canWrite }: { actorId: string; tournamentId: string; events: { eventId: string; name: string }[]; canWrite: boolean }) {
  const key = `payment-operation:${actorId}:${tournamentId}:multi-event-simulation`;
  const conflictKey = `${key}:blocked`;
  const endpoint = `/api/v1/tournaments/${tournamentId}/simulation-finance`;
  const [eventId, setEventId] = useState(events[0]?.eventId ?? "");
  const [workspace, setWorkspace] = useState<State | null>(null);
  const [pending, setPending] = useState<SimulationRecovery | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading simulation setup.");
  const [reason, setReason] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [receiptPlayer, setReceiptPlayer] = useState("");
  const [receiptEvents, setReceiptEvents] = useState<string[]>([]);
  const [receiptDraft, setReceiptDraft] = useState<ReturnType<typeof buildSimulatedPoolReceipt>>(null);
  const [expenseAmounts, setExpenseAmounts] = useState<Record<string,string>>({});
  const [expenseDraft, setExpenseDraft] = useState<ReturnType<typeof buildSimulatedExpense>>(null);
  const [expenseSplits, setExpenseSplits] = useState<Record<string,Record<string,string>>>({});
  const [classificationDraft, setClassificationDraft] = useState<ReturnType<typeof buildSimulatedClassification>>(null);
  const stored = useRef<string | null>(null);
  const flight = useRef(false);
  const receiptRevision = useRef(0);

  const load = useCallback(async (id: string): Promise<State | null> => {
    const response = await fetch(`${endpoint}?eventId=${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !isProjectedSimulatedFinanceSelector(data, tournamentId, id)) return null;
    return data as State;
  }, [endpoint, tournamentId]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
    if (!active) return;
    try {
      const raw = sessionStorage.getItem(key); stored.current = raw;
      const conflict = sessionStorage.getItem(conflictKey);
      if (raw) { const value: unknown = JSON.parse(raw); if (isSimulationRecovery(value, actorId, tournamentId)) {
        setPending(value);
        if (conflict !== null) { setBlocked(true); setMessage("The prior simulated action conflicted with its source. The exact request remains saved; do not submit another copy."); }
        else setMessage("An earlier simulated action is pending. Retry that exact action before continuing.");
      } else { setBlocked(true); setMessage("Saved recovery data could not be verified. Keep this tab and its saved work intact."); } }
      else if (conflict !== null) { setBlocked(true); setMessage("A saved conflict marker has no matching request. Keep this tab and its saved work intact."); }
    } catch { setBlocked(true); setMessage("Saved recovery data could not be read. Keep this tab and its saved work intact."); }
    setRecoveryReady(true);
    });
    return () => { active = false; };
  }, [actorId, conflictKey, key, tournamentId]);
  useEffect(() => {
    let active = true;
    if (!eventId) return;
    load(eventId).then(value => { if (active) { setWorkspace(value); if (!value) setMessage("Simulation details could not be verified. Nothing was changed."); else if (value.status === "blocked") setMessage(value.code === "owner_enrollment_required" || value.code === "synthetic_fixture_required" ? "This test event needs its approved owner enrollment before simulation. No access was added." : "This event's simulation sources are unavailable. No records were changed."); else setMessage(previous => previous === "Loading simulation setup." ? "" : previous); } }).catch(() => { if (active) setMessage("Simulation details could not be verified. Nothing was changed."); });
    return () => { active = false; };
  }, [eventId, load]);

  async function submit(request: Record<string, unknown>) {
    if (flight.current || blocked || !canWrite || !recoveryReady || workspace?.status !== "available" || workspace.financialClosed) return;
    const item = pending ?? { actorId, tournamentId, request };
    if (!isSimulationRecovery(item, actorId, tournamentId)) { setMessage("The simulated action was incomplete. Nothing was saved."); return; }
    flight.current = true; setBusy(true);
    try {
      if (sessionStorage.getItem(key) !== stored.current) { setBlocked(true); setMessage("Saved work changed in another tab. It was preserved; reload before continuing."); return; }
      if (!pending) {
        const raw = JSON.stringify(item);
        try { setAppRecoveryItem(sessionStorage, key, raw); if (sessionStorage.getItem(key) !== raw) throw new Error("recovery_write_unconfirmed"); }
        catch { setBlocked(true); setMessage("Recovery safety could not be established. Nothing was sent; keep this tab open."); return; }
        stored.current = raw; setPending(item);
      }
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(item.request) });
      const data: unknown = await response.json().catch(() => null);
      if (sessionStorage.getItem(key) !== stored.current) { setBlocked(true); setMessage("Saved work changed while waiting. The newer work was preserved."); return; }
      if (response.ok && isAcceptedSimulationResult(data, item.request)) {
        sessionStorage.removeItem(key);
        if (sessionStorage.getItem(key) !== null) { setBlocked(true); setMessage("The simulation action was saved, but recovery cleanup could not be confirmed. Keep this tab open."); return; }
        stored.current = null; setPending(null); setReviewed(false); setReceiptDraft(null); setExpenseDraft(null); setClassificationDraft(null); setExpenseAmounts({}); setExpenseSplits({}); setMessage("Simulated record saved. No money moved and no independent human consent is claimed.");
        setWorkspace(await load(eventId));
      } else if (response.status === 409) {
        setBlocked(true);
        try { const marker = JSON.stringify({ actorId, tournamentId, operationId: item.request.operationId }); setAppRecoveryItem(sessionStorage, conflictKey, marker); if (sessionStorage.getItem(conflictKey) !== marker) throw new Error("conflict_write_unconfirmed");
          setMessage("The simulation record could not be applied because its source or operation changed. The exact request remains saved; do not submit another copy.");
        } catch { setMessage("The simulation record conflicted. The exact request remains saved, but its conflict warning could not be saved; keep this tab open and do not retry."); }
      }
      else setMessage("The result is uncertain. Keep this exact saved request and retry when connected.");
    } catch { setMessage("The result is uncertain. Keep this exact saved request and retry when connected."); }
    finally { flight.current = false; setBusy(false); }
  }
  const closed = workspace?.status !== "available" || workspace.financialClosed;
  const lock = closed || !recoveryReady || busy || blocked || !!pending || !canWrite || !reviewed || !reason.trim();
  async function receipt() {
    const revision = receiptRevision.current;
    try {
      const loaded = await Promise.all(receiptEvents.map(load));
      if (revision !== receiptRevision.current) return;
      if (loaded.some(x => !x || x.status !== "available")) { setMessage("The selected event sources could not be verified. No receipt was recorded."); return; }
      const data = buildSimulatedPoolReceipt(loaded as Workspace[], receiptPlayer, syntheticReason(reason));
      if (!data) { setMessage("Every selected event needs this player, every pool disclosure, and a recorded election before its simulated receipt."); return; }
      setReceiptDraft(data); setReviewed(false);
      setMessage("Review the simulated receipt and check the confirmation before recording it.");
    } catch { setMessage("The selected event sources could not be verified. No receipt was recorded."); }
  }
  function prepareExpense() {
    const entries = events.flatMap(e => { const value = expenseAmounts[e.eventId]?.trim(); if (!value) return []; const amountMinor = simulatedDollars(value); return [{ eventId: e.eventId, amountMinor: amountMinor ?? -1 }]; });
    const draft = buildSimulatedExpense(entries, syntheticReason(reason));
    if (!draft) { setMessage("Enter positive event amounts for this simulated expense. Nothing was recorded."); return; }
    setExpenseDraft(draft); setReviewed(false); setMessage("Review this simulated expense split before recording it.");
  }
  function prepareClassification() {
    if (!workspace || workspace.status !== "available" || workspace.sanctioningAssessmentMinor === null) return;
    const rows = workspace.sources.expenses.map(e => { const values = expenseSplits[e.id] ?? {}; return { sourceId: e.id, sourceMinor: e.amountMinor,
      operating: values.operating?.trim() ? simulatedDollars(values.operating) ?? -1 : 0,
      player_benefit: values.player_benefit?.trim() ? simulatedDollars(values.player_benefit) ?? -1 : 0,
      sanctioning: values.sanctioning?.trim() ? simulatedDollars(values.sanctioning) ?? -1 : 0 }; });
    const draft = buildSimulatedClassification(rows, workspace.sanctioningAssessmentMinor, workspace.sources.sourceDigest, workspace.expenseReviewVersion, syntheticReason(reason));
    if (!draft) { setMessage("Each expense must be fully classified, and sanctioning must match the event assessment. Nothing was recorded."); return; }
    setClassificationDraft(draft); setReviewed(false); setMessage("Review the expense classifications before recording them.");
  }
  return <section aria-labelledby="simulation-finance-title"><h2 id="simulation-finance-title">Test-only event finances</h2>
    <p>No actual cash or payment is recorded. One operator is simulating the policy disclosures and elections; no independent human consent is claimed. This is not finalized accounting.</p>
    {!canWrite && <p>Only the Director can record these simulated entries. Co-directors can view them.</p>}
    {workspace?.status === "available" && workspace.financialClosed && <p>Joint simulated financial finalization is recorded. This workspace is read-only; no actual money moved.</p>}
    <label>Event<select value={eventId} disabled={busy || !!pending} onChange={e => { receiptRevision.current++; setWorkspace(null); setEventId(e.target.value); setReceiptDraft(null); setClassificationDraft(null); setExpenseSplits({}); setReceiptPlayer(""); setReviewed(false); }}><option value="">Select an event</option>{events.map(e => <option key={e.eventId} value={e.eventId}>{e.name}</option>)}</select></label>
    {workspace?.status === "available" && <>
      <h3>Pool disclosures and elections</h3><p>Record each test policy, then each fictional player&apos;s election before the simulated receipt.</p>
      {workspace.pools.map(pool => { const terms = policy(pool); return <section key={pool.definitionId}><h4>{pool.name} · {money(pool.feeMinor)}</h4><p>{pool.type ?? "Historical type not recorded"}</p><p>{policyTerms(pool)}</p>
        {!pool.policyId ? <><button type="button" disabled={lock || !terms || workspace.eventStarted || workspace.anyReceiptRecorded} onClick={() => terms && void submit({ action: "disclose", operationId: crypto.randomUUID(), eventId, request: { kind: pool.kind, poolDefinitionId: pool.definitionId, ...terms, disclosureReference: syntheticReason(reason), disclosed: true } })}>Record simulated disclosure</button>{(workspace.eventStarted || workspace.anyReceiptRecorded) && <p>Policy changes are closed after a simulated receipt or event start.</p>}</> : <><p>Test policy recorded.</p>{workspace.participants.map(player => { const prior = player.elections.find(e => e.policyId === pool.policyId); const closed = workspace.eventStarted || player.receiptRecorded; return <div key={player.participantId}><span>{player.name}: {prior ? (prior.elected ? "included" : "not included") : "not yet recorded"} {closed ? "(changes closed)" : ""}</span>{[true, false].map(elected => <button key={String(elected)} type="button" disabled={lock || closed} onClick={() => void submit({ action: "election", operationId: crypto.randomUUID(), eventId, request: { policyId: pool.policyId, participantId: player.participantId, expectedVersion: prior?.version ?? 0, elected, reason: syntheticReason(reason), reviewed: true } })}>{elected ? "Include in test pool" : "Do not include"}</button>)}</div>; })}</>}
        {!terms && !pool.policyId && <p>This pool type is not supported by the simulation; no policy can be recorded here.</p>}</section>; })}
      <h3>One simulated receipt</h3><label>Fictional player<select disabled={closed} value={receiptPlayer} onChange={e => { receiptRevision.current++; setReceiptPlayer(e.target.value); setReceiptDraft(null); setReviewed(false); }}><option value="">Select a player</option>{workspace.participants.map(p => <option key={p.rosterEntryId} value={p.rosterEntryId} disabled={p.receiptRecorded || workspace.eventStarted}>{p.name}{p.receiptRecorded ? " (receipt already recorded for this event)" : ""}</option>)}</select></label>
      <fieldset><legend>Events on this receipt</legend>{events.map(e => <label key={e.eventId}><input type="checkbox" disabled={closed} checked={receiptEvents.includes(e.eventId)} onChange={x => { receiptRevision.current++; setReceiptEvents(x.target.checked ? [...receiptEvents, e.eventId] : receiptEvents.filter(id => id !== e.eventId)); setReceiptDraft(null); setReviewed(false); }}/>{e.name}</label>)}</fieldset>
      <button type="button" disabled={closed || !recoveryReady || busy || blocked || !!pending || !canWrite || !reason.trim() || !receiptPlayer || !receiptEvents.length} onClick={() => void receipt()}>Review simulated receipt</button>
      {receiptDraft && <div><p>Simulated total: <strong>{money(receiptDraft.amountMinor)}</strong></p><ul>{receiptDraft.events.map(line => <li key={line.eventId}>{events.find(e => e.eventId === line.eventId)?.name ?? "Event"}: base {money(line.baseMinor)}, Q Pools {money(line.q.reduce((sum, p) => sum + p.amountMinor, 0))}, Side Pools {money(line.side.reduce((sum, p) => sum + p.amountMinor, 0))}</li>)}</ul><button type="button" disabled={lock} onClick={() => void submit({ action: "receipt", operationId: crypto.randomUUID(), request: receiptDraft })}>Record one simulated receipt</button></div>}
      <h3>Simulated expense</h3><p>Enter the portion assigned to each event; leave other events blank. No actual expense payment is recorded.</p>
      {events.map(e => <label key={e.eventId}>{e.name} amount in dollars<input disabled={closed} inputMode="decimal" value={expenseAmounts[e.eventId] ?? ""} onChange={x => { setExpenseAmounts({ ...expenseAmounts, [e.eventId]: x.target.value }); setExpenseDraft(null); setReviewed(false); }}/></label>)}
      <button type="button" disabled={closed || !recoveryReady || busy || blocked || !!pending || !canWrite || !reason.trim()} onClick={prepareExpense}>Review simulated expense</button>
      {expenseDraft && <div><p>Simulated expense total: <strong>{money(expenseDraft.amountMinor)}</strong></p><ul>{expenseDraft.allocations.map(line => <li key={line.eventId}>{events.find(e => e.eventId === line.eventId)?.name ?? "Event"}: {money(line.amountMinor)}</li>)}</ul><button type="button" disabled={lock} onClick={() => void submit({ action: "expense", operationId: crypto.randomUUID(), request: expenseDraft })}>Record simulated expense</button></div>}
      <h3>Classify this event&apos;s simulated expenses</h3>
      {workspace.sanctioningAssessmentMinor === null ? <p>The event&apos;s sanctioning assessment is not available yet; classification must wait for its supported source.</p> : <><p>Sanctioning assessment: {money(workspace.sanctioningAssessmentMinor)}. The three amounts for each expense must add up to that expense.</p>
        {workspace.sources.expenses.map(expense => <fieldset key={expense.id}><legend>{expense.reason.slice(20).trim()} · {money(expense.amountMinor)}</legend>{([["operating","Operating"],["player_benefit","Player benefit"],["sanctioning","Sanctioning"]] as const).map(([field,label]) => <label key={field}>{label} amount in dollars<input disabled={closed} inputMode="decimal" value={expenseSplits[expense.id]?.[field] ?? ""} onChange={x => { setExpenseSplits({ ...expenseSplits, [expense.id]: { ...expenseSplits[expense.id], [field]: x.target.value } }); setClassificationDraft(null); setReviewed(false); }}/></label>)}</fieldset>)}
        <button type="button" disabled={closed || !recoveryReady || busy || blocked || !!pending || !canWrite || !reason.trim() || workspace.sources.blockers.some(x => x !== "expense_classification_required")} onClick={prepareClassification}>Review classifications</button>
        {classificationDraft && <div><p>Reviewed {workspace.sources.expenses.length} simulated expenses; sanctioning {money(workspace.sanctioningAssessmentMinor)}.</p><button type="button" disabled={lock} onClick={() => void submit({ action: "classify", operationId: crypto.randomUUID(), eventId, request: classificationDraft })}>Record expense classifications</button></div>}
      </>}
      <p><a href={`/tournament/${tournamentId}/events/${eventId}/simulated-accounting`}>Review simulated awards</a> (read-only). No settlement is available on this screen.</p>
    </>}
    <label>Why is this being simulated?<input disabled={closed} maxLength={470} value={reason} onChange={e => { receiptRevision.current++; setReason(e.target.value); setReviewed(false); setReceiptDraft(null); setExpenseDraft(null); setClassificationDraft(null); }}/></label>
    <label><input type="checkbox" disabled={closed} checked={reviewed} onChange={e => setReviewed(e.target.checked)}/>I reviewed this fictional action and understand that no money or independent consent is recorded.</label>
    {pending && <button type="button" disabled={closed || busy || blocked || !canWrite} onClick={() => void submit(pending.request)}>Retry exact saved simulation action</button>}
    <p role="status">{message}</p>
  </section>;
}
