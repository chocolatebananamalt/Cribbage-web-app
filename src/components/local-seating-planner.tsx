"use client";
import { useEffect, useRef, useState } from "react";
import OneTableMovementPreview from "./one-table-movement-preview";
import { buildFacingGeometry, validateLocalRandomPlanInput, type LocalRandomPlanInput } from "../lib/seating/local-random-plan";
import { canonicalLocalPlan, isLocalSeatingCapability, isLocalSeatingReceipt, localSeatingNotice, localRedrawReasons, type LocalRedrawReason, type LocalSeatingCapability, type LocalSeatingRequest } from "../lib/api/local-seating-planner";
import { anonymousPlannerStorageKey, readAnonymousPlannerState, saveAnonymousPlannerState, type AnonymousPlannerState } from "../lib/seating/anonymous-planner-storage";
const endpoint = "/api/v1/local-seating-plans";
export function anonymousSeatingInput(): LocalRandomPlanInput {
  const tables = ["A", "B", "C"].map(tableId => ({ tableId, seatCount: 6 }));
  return { source: { version: 1, sha256: "0".repeat(64) }, registration: "open", seating: "unpublished", existingTournamentIds: [],
    participants: Array.from({ length: 18 }, (_, i) => ({ participantId: `entry-${String(i + 1).padStart(2, "0")}`, stationaryPreference: "none" })),
    tables, activePairIds: buildFacingGeometry(tables).pairs.map(pair => pair.pairId), anchor: { participantId: null, seatId: "A-1", directorApproved: false }, stationaryDecisions: [], constraints: [], maxAttempts: 128 };
}
const name = (id: string) => `Entry ${Number(id.slice(-2))}`;
async function sha(text: string) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, "0")).join(""); }
export default function LocalSeatingPlanner() {
  const [state, setState] = useState<AnonymousPlannerState | null>(null), [capability, setCapability] = useState<LocalSeatingCapability | null>(null);
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState("Loading this device's anonymous planning draft.");
  const [redrawReason, setRedrawReason] = useState<LocalRedrawReason | "">(""), [redrawConfirmed, setRedrawConfirmed] = useState(false);
  const [avoidA, setAvoidA] = useState("entry-01"), [avoidB, setAvoidB] = useState("entry-02"), [avoidRound, setAvoidRound] = useState(1), [avoidConfirmed, setAvoidConfirmed] = useState(false);
  const raw = useRef<string | null>(null), flight = useRef(false);
  function commit(next: AnonymousPlannerState) {
    const saved = saveAnonymousPlannerState(sessionStorage, next, raw.current);
    if (saved === null) { setBlocked(true); setMessage("This local draft could not be safely saved or another copy changed it. Keep the existing record intact."); return false; }
    raw.current = saved; setState(next); return true;
  }
  async function getCapability() {
    const response = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok || !isLocalSeatingCapability(value)) throw new Error("local_planner_unavailable");
    setCapability(value); return value;
  }
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const saved = readAnonymousPlannerState(sessionStorage);
      if (saved.status === "blocked") { setBlocked(true); setMessage("An unknown local planning record is preserved. No draw or overwrite is allowed."); return; }
      if (saved.status === "saved") { raw.current = saved.raw; setState(saved.value); setMessage(saved.value.current?.receipt === null ? "A planning outcome is unknown. Check the saved outcome; do not repeat the draw." : "Local draft restored. No draw ran on refresh. Cached previews are not official seating records."); }
      else if (commit({ kind: "anonymous-seating-draft-v1", plannerId: crypto.randomUUID(), draft: anonymousSeatingInput(), current: null, history: [] })) setMessage("Anonymous local draft ready. Review the planning assumptions before requesting a draw.");
      void getCapability().catch(() => { if (active) setMessage("The local planner is unavailable. Your saved choices remain intact."); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, []);
  function edit(update: (draft: LocalRandomPlanInput) => LocalRandomPlanInput) {
    if (!state || busy || flight.current || blocked || state.current) return;
    const draft = update(structuredClone(state.draft));
    draft.source = { version: state.draft.source.version + 1, sha256: "0".repeat(64) };
    commit({ ...state, draft });
  }
  async function draw() {
    if (!state || state.current || busy || flight.current || blocked || !capability) return;
    flight.current = true; setBusy(true);
    try {
      const latest = await getCapability();
      const input = structuredClone(state.draft), { source, ...assumptions } = input;
      input.source = { version: source.version, sha256: await sha(canonicalLocalPlan(assumptions)) };
      const request: LocalSeatingRequest = { kind: "local-seating-preview-v1", plannerId: state.plannerId, operationId: crypto.randomUUID(), epochId: latest.epochId, inputDigest: await sha(canonicalLocalPlan(input)), input };
      const next: AnonymousPlannerState = { ...state, draft: input, current: { request, receipt: null } };
      if (!commit(next)) return;
      const expected = raw.current;
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const value: unknown = await response.json().catch(() => null);
      if (sessionStorage.getItem(anonymousPlannerStorageKey) !== expected || raw.current !== expected) { setBlocked(true); setMessage("A newer local draft exists. This older response cannot overwrite it."); return; }
      if (response.ok && isLocalSeatingReceipt(value, request)) {
        if (commit({ ...next, current: { request, receipt: value } })) setMessage(value.result.status === "candidate" ? "Local candidate saved. No permanent IDs were assigned. Physical movement still requires review." : "Planning stopped without assigning any IDs. Review the listed reasons.");
      } else setMessage("The planning outcome is unknown. The exact request is retained. Check its saved outcome instead of drawing again.");
    } catch { setMessage("The planning outcome could not be confirmed. If a request was saved, keep it and check its outcome. No automatic redraw will run."); }
    finally { flight.current = false; setBusy(false); }
  }
  async function reconcile() {
    if (!state?.current || state.current.receipt || busy || flight.current || blocked) return;
    flight.current = true; setBusy(true); const expected = raw.current, request = state.current.request;
    try {
      const query = new URLSearchParams({ plannerId: request.plannerId, operationId: request.operationId, epochId: request.epochId });
      const response = await fetch(`${endpoint}?${query}`, { cache: "no-store", credentials: "same-origin" });
      const value: unknown = await response.json().catch(() => null);
      if (sessionStorage.getItem(anonymousPlannerStorageKey) !== expected || raw.current !== expected) { setBlocked(true); setMessage("The local draft changed. This old response cannot overwrite it."); return; }
      if (response.ok && isLocalSeatingReceipt(value, request)) {
        if (commit({ ...state, current: { request, receipt: value } })) setMessage("The same saved planning outcome was recovered. No new randomness was used.");
      } else setMessage("The saved outcome is unavailable, possibly because the local server restarted. Its request remains intact; no new draw ran.");
    } catch { setMessage("The saved outcome could not be read. Its request remains intact; no new draw ran."); }
    finally { flight.current = false; setBusy(false); }
  }
  function beginComparison() {
    if (!state?.current || !redrawReason || !redrawConfirmed || busy || flight.current || blocked || state.history.length >= 8) return;
    if (commit({ ...state, current: null, history: [...state.history, { ...state.current, reason: redrawReason }] })) { setRedrawReason(""); setRedrawConfirmed(false); setMessage("Previous local outcome/request archived with your reason. Review the assumptions, then explicitly request another preview."); }
  }
  if (!state) return <p role="status">{message}</p>;
  const input = state.draft, locked = busy || blocked || state.current !== null;
  const geometry = buildFacingGeometry(input.tables), selected = geometry.pairs.filter(pair => input.activePairIds.includes(pair.pairId)), activeSeats = selected.flatMap(pair => pair.seats);
  const unavailablePairs = input.activePairIds.filter(id => !geometry.pairs.some(pair => pair.pairId === id));
  const issues = validateLocalRandomPlanInput(input), result = state.current?.receipt?.result;
  const readonly = input.seating === "published" || input.existingTournamentIds.length > 0;
  return <div className="local-seat-planner"><p role="note"><strong>{localSeatingNotice}</strong> All entries below are anonymous planning aliases. Existing tournament data, player requests and family records are not loaded.</p><p role="status" aria-live="polite">{message}</p>
    <fieldset disabled={locked}><legend>1. Planning assumptions</legend><label><input type="checkbox" checked={input.registration === "closed"} onChange={event => edit(draft => ({ ...draft, registration: event.target.checked ? "closed" : "open" }))} />Assume registration is closed for this local comparison</label><label><input type="checkbox" checked={readonly} onChange={event => edit(draft => ({ ...draft, seating: event.target.checked ? "published" : "unpublished", existingTournamentIds: event.target.checked ? ["A-1"] : [] }))} />Model existing published IDs — no redraw is allowed</label><p>This is an assumption, not a verified registration check. Live integration must read the server&apos;s actual closed roster.</p></fieldset>
    <fieldset disabled={locked}><legend>2. Physical tables and facing seats</legend>{input.tables.map(table => <div key={table.tableId}><label>Table {table.tableId}: available chairs<input aria-label={`Table ${table.tableId} available chairs`} type="number" step="1" min="1" max="20" value={table.seatCount} onChange={event => { const count = Math.max(1, Math.min(20, Math.trunc(Number(event.target.value)) || 1)); edit(draft => ({ ...draft, tables: draft.tables.map(t => t.tableId === table.tableId ? { ...t, seatCount: count } : t), anchor: { ...draft.anchor, directorApproved: false } })); }} /></label><button type="button" className="secondary" disabled={input.tables.length === 1} onClick={() => edit(draft => ({ ...draft, tables: draft.tables.filter(t => t.tableId !== table.tableId), anchor: { ...draft.anchor, directorApproved: false } }))}>Remove Table {table.tableId}</button>
      <div className="local-seat-map" role="region" aria-label={`Table ${table.tableId} facing-seat layout`} tabIndex={0}><table><caption>Table {table.tableId}: odd and even seats face each other</caption><tbody>{[1,2].map(side => <tr key={side}><th scope="row">{side === 1 ? "Odd side" : "Even side"}</th>{Array.from({ length: Math.ceil(table.seatCount / 2) }, (_, i) => { const n = i * 2 + side; return <td key={n}>{n <= table.seatCount ? `${table.tableId}-${n}${side === 1 && n === table.seatCount ? " (unpaired, unused)" : ""}` : "No chair"}</td>; })}</tr>)}</tbody></table></div>
    </div>)}<button type="button" className="secondary" disabled={input.tables.length >= 26} onClick={() => { const id = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find(letter => !input.tables.some(t => t.tableId === letter)); if (id) edit(draft => ({ ...draft, tables: [...draft.tables, { tableId: id, seatCount: 6 }], anchor: { ...draft.anchor, directorApproved: false } })); }}>Add physical table</button>
      <p>Choose exactly nine complete facing pairs (18 occupied seats). Extra chairs stay unused; no movement direction is certified here.</p><div className="local-seat-pairs">{geometry.pairs.map(pair => <label key={pair.pairId}><input type="checkbox" checked={input.activePairIds.includes(pair.pairId)} onChange={event => edit(draft => ({ ...draft, activePairIds: event.target.checked ? [...draft.activePairIds, pair.pairId] : draft.activePairIds.filter(id => id !== pair.pairId), anchor: { ...draft.anchor, directorApproved: false } }))} />{pair.seats[0].seatId} faces {pair.seats[1].seatId}</label>)}</div><p>{input.activePairIds.length} selected pairs; {input.activePairIds.length * 2} proposed occupied seats. {geometry.unpairedSeats.length} unpaired chairs cannot be used.</p>{unavailablePairs.map(id => <p key={id} role="alert">Previously selected {id} is no longer a complete pair. <button type="button" className="secondary" onClick={() => edit(draft => ({ ...draft, activePairIds: draft.activePairIds.filter(p => p !== id) }))}>Remove unavailable pair {id}</button></p>)}</fieldset>
    <fieldset disabled={locked}><legend>3. Stationary slot and preferences</legend><p>The movement candidate needs one stationary slot. With no person pinned, all 18 entries participate in the blind draw. A requested stationary preference is a separate planning choice.</p><label>Proposed Stationary Seat<select value={input.anchor.seatId} onChange={event => edit(draft => ({ ...draft, anchor: { ...draft.anchor, seatId: event.target.value, directorApproved: false } }))}>{!activeSeats.some(seat => seat.seatId === input.anchor.seatId) && <option value={input.anchor.seatId}>Unavailable previous choice: {input.anchor.seatId}</option>}{activeSeats.map(seat => <option key={seat.seatId}>{seat.seatId}</option>)}</select></label><label>Who occupies that stationary slot?<select value={input.anchor.participantId ?? ""} onChange={event => edit(draft => ({ ...draft, anchor: { ...draft.anchor, participantId: event.target.value || null, directorApproved: false } }))}><option value="">Blind draw — include all 18 entries</option>{input.participants.map(p => <option key={p.participantId} value={p.participantId}>{name(p.participantId)} — explicit approved-person exception</option>)}</select></label><label><input type="checkbox" checked={input.anchor.directorApproved} onChange={event => edit(draft => ({ ...draft, anchor: { ...draft.anchor, directorApproved: event.target.checked } }))} />I approve this slot and any explicitly pinned person for this planning comparison</label>
      {input.participants.map(p => <div key={p.participantId}><label><input type="checkbox" checked={p.stationaryPreference === "requested"} onChange={event => edit(draft => ({ ...draft, participants: draft.participants.map(item => item.participantId === p.participantId ? { ...item, stationaryPreference: event.target.checked ? "requested" : "none" } : item), anchor: { ...draft.anchor, directorApproved: false } }))} />{name(p.participantId)} requests a stationary seat (planning example)</label>{(p.stationaryPreference === "requested" || input.stationaryDecisions.some(d => d.participantId === p.participantId)) && <label>Planning decision for {name(p.participantId)}<select aria-label={`Planning decision for ${name(p.participantId)}`} value={input.stationaryDecisions.find(d => d.participantId === p.participantId)?.decision ?? ""} onChange={event => edit(draft => ({ ...draft, stationaryDecisions: [...draft.stationaryDecisions.filter(d => d.participantId !== p.participantId), ...(event.target.value ? [{ participantId: p.participantId, decision: event.target.value as "selected-anchor" | "not-accommodated" }] : [])], anchor: { ...draft.anchor, directorApproved: false } }))}><option value="">Unresolved — keep blocked</option><option value="selected-anchor">Selected as the approved stationary person</option><option value="not-accommodated">Not accommodated in this single-anchor comparison</option></select></label>}</div>)}</fieldset>
    <fieldset disabled={locked}><legend>4. Explicit planning avoidance</legend><p>No family policy is inferred from names or ACC numbers. Model only an exact pair and exact round; real family eligibility and duration still need verified policy.</p>{input.constraints.map((c, index) => <p key={c.sourceReference}>Do not pair {name(c.participantIds[0])} with {name(c.participantIds[1])} in round {c.round}. <button type="button" className="secondary" onClick={() => edit(draft => ({ ...draft, constraints: draft.constraints.filter((_, i) => i !== index) }))}>Remove avoidance {index + 1}</button></p>)}<label>First Entry<select value={avoidA} onChange={event => setAvoidA(event.target.value)}>{input.participants.map(p => <option key={p.participantId} value={p.participantId}>{name(p.participantId)}</option>)}</select></label><label>Other Entry<select value={avoidB} onChange={event => setAvoidB(event.target.value)}>{input.participants.map(p => <option key={p.participantId} value={p.participantId}>{name(p.participantId)}</option>)}</select></label><label>Exact Round<input type="number" step="1" min="1" max="12" value={avoidRound} onChange={event => setAvoidRound(Math.max(1, Math.min(12, Math.trunc(Number(event.target.value)) || 1)))} /></label><label><input type="checkbox" checked={avoidConfirmed} onChange={event => setAvoidConfirmed(event.target.checked)} />I have specified this exact planning avoidance, not an assumed ACC family rule</label><button type="button" className="secondary" disabled={!avoidConfirmed || avoidA === avoidB || input.constraints.length >= 36 || input.constraints.some(c => c.round === avoidRound && c.participantIds.includes(avoidA) && c.participantIds.includes(avoidB))} onClick={() => { edit(draft => ({ ...draft, constraints: [...draft.constraints, { kind: "avoid-pair-in-round", participantIds: [avoidA, avoidB], round: avoidRound, verified: true, sourceReference: `LOCAL-PLAN-${crypto.randomUUID().slice(0,8).toUpperCase()}` }] })); setAvoidConfirmed(false); }}>Add this planning avoidance</button></fieldset>
    {readonly && <p role="alert">Existing IDs are modeled as fixed. No draw will run and no ID can be changed here.</p>}{issues.length > 0 && <section aria-label="Planning blockers"><h2>Resolve before drawing</h2><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></section>}
    <button type="button" className="primary" disabled={locked || !capability || issues.length > 0 || readonly} onClick={() => void draw()}>Generate local random candidate</button>
    {state.current && <section aria-label="Local planning outcome"><h2>{state.current.receipt ? "Saved local comparison" : "Unknown planning outcome"}</h2>{!state.current.receipt && <button type="button" className="secondary" disabled={busy || blocked} onClick={() => void reconcile()}>Check saved outcome — no new draw</button>}{result?.status === "candidate" && <><p><strong>Candidate only: 108 matches, 12 distinct opponents per entry, no sit-outs.</strong> Physical walking directions are not verified. Publication is unavailable.</p><OneTableMovementPreview config={input} candidate={result}/><p>Stationary occupant: {name(result.anchor.participantId)} at {result.anchor.seatId}; {result.anchor.selection === "blind-draw" ? "included in the blind draw" : "explicit approved-person exception"}.</p><div className="local-seat-map" role="region" aria-label="Proposed starting seats" tabIndex={0}><table><caption>Proposed starting seats and IDs — none assigned</caption><thead><tr><th>Planning entry</th><th>Proposed Tournament ID</th></tr></thead><tbody>{result.assignments.map(a => <tr key={a.participantId}><td>{name(a.participantId)}</td><td>{a.tournamentId}</td></tr>)}</tbody></table></div><details><summary>Inspect candidate rounds (not physical movement instructions)</summary>{Array.from({ length: 12 }, (_, index) => <section key={index}><h3>Round {index + 1}</h3><ul>{result.matches.filter(m => m.round === index + 1).map(m => <li key={m.pairId}>{name(m.sides[0].participantId)} at {m.sides[0].seatId} / {name(m.sides[1].participantId)} at {m.sides[1].seatId}</li>)}</ul></section>)}</details></>}{result?.status === "blocked" && <ul>{result.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}{result?.status === "readonly" && <p>{result.reason}</p>}
      <label>Reason for Another Comparison<select value={redrawReason} onChange={event => setRedrawReason(event.target.value as LocalRedrawReason)}><option value="">Choose a reason</option>{localRedrawReasons.map(reason => <option key={reason} value={reason}>{reason.replaceAll("-", " ")}</option>)}</select></label><label><input type="checkbox" checked={redrawConfirmed} onChange={event => setRedrawConfirmed(event.target.checked)} />Keep the previous request/outcome in local history and prepare a separate comparison</label><button type="button" className="secondary" disabled={busy || blocked || !redrawReason || !redrawConfirmed || state.history.length >= 8} onClick={beginComparison}>Prepare another local comparison</button><p>{state.history.length} previous local comparisons retained. This is editable device history, not an immutable tournament audit. Reloading never generates a draw.</p></section>}
  </div>;
}
