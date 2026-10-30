"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { balancedQMethodV3, equalQMethodV2, isQOperatingRequestV2, isQOperatingRequestV3, isQOperatingResultV2, isQOperatingResultV3, isQOperatingWorkspaceV3, qOperatingResultMatchesV2, qOperatingResultMatchesV3, type QOperatingRequestV2, type QOperatingRequestV3, type QOperatingWorkspaceV3 } from '../../../../lib/api/q-operating-schedules';
import { isUuid } from '../../../../lib/api/validation';
import { calculateAccWeightedPool } from '../../../../lib/results/acc-weighted-pool';
import { operatingWorkspacePoolPreview } from '../../../../lib/results/q-operating-workspace-preview';
import { qChartSchedules, qChartUserClarifiedPage5Counts } from '../../../../lib/results/q-chart-catalog';
import { formatUsd } from '../../../../lib/money';
import { setAppRecoveryItem } from '../../../../lib/recovery-write-coordinator';

type Envelope = { kind: 'q-operating-v2'; operationId: string; request: QOperatingRequestV2 } | { kind: 'q-operating-v3'; operationId: string; request: QOperatingRequestV3 };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function isOperatingEnvelope(v: unknown): v is Envelope {
 return object(v) && Object.keys(v).sort().join() === 'kind,operationId,request' && isUuid(v.operationId)
  && (v.kind === 'q-operating-v2' ? isQOperatingRequestV2(v.request) : v.kind === 'q-operating-v3' && isQOperatingRequestV3(v.request));
}
/** Kept as a named read-only seam for existing callers and historical charts. */
export const operatingPoolPreview = operatingWorkspacePoolPreview;
const label = (s: string) => s.replaceAll('_', ' ');
export default function QOperatingClient({ actorId, tournamentId, source: initialSource }: { actorId: string; tournamentId: string; source: QOperatingWorkspaceV3 | null }) {
 const urlV2 = `/api/v1/tournaments/${tournamentId}/q-operating-schedules`, urlV3 = `/api/v1/tournaments/${tournamentId}/q-operating-schedules-v3`;
 const oldKey = `payment-obligation:q-operating-v2:${actorId}:${tournamentId}`, newKey = `payment-obligation:q-operating-v3:${actorId}:${tournamentId}`;
 const [source, setSource] = useState(initialSource), [ready, setReady] = useState(false), [blocked, setBlocked] = useState(false), [busy, setBusy] = useState(false), [needsRefresh, setNeedsRefresh] = useState(false);
 const [pending, setPending] = useState<Envelope | null>(null), [message, setMessage] = useState('Checking retained operating-schedule work.');
 const [poolId, setPoolId] = useState(initialSource?.membership?.pools[0]?.poolVersionId ?? ''), [method, setMethod] = useState<'balanced' | 'equal'>('balanced');
 const [ratio, setRatio] = useState<4 | 6>(6), [illustrativeCount, setIllustrativeCount] = useState('16'), [reference, setReference] = useState(''), [disclosed, setDisclosed] = useState(false);
 const flight = useRef(false), retained = useRef<string | null>(null);
 const load = useCallback(async () => {
  const response = await fetch(urlV3, { cache: 'no-store' }), value: unknown = await response.json();
  if (!response.ok || !isQOperatingWorkspaceV3(value, tournamentId)) throw Error('workspace_unavailable');
  setSource(value); setDisclosed(false); setNeedsRefresh(false);
 }, [urlV3, tournamentId]);
 const finish = useCallback(async (raw: string, e: Envelope, result: unknown) => {
  const matches = e.kind === 'q-operating-v3' ? isQOperatingResultV3(result) && qOperatingResultMatchesV3(result, e.request) : isQOperatingResultV2(result) && qOperatingResultMatchesV2(result, e.request);
  if (!matches) { setMessage('Outcome remains uncertain. The exact request is retained.'); return; }
  const checked = result as { status: string; code?: string };
  if (checked.status === 'rejected' && checked.code === 'idempotency_conflict') { setBlocked(true); setMessage('Operation identity conflict. Retained work is preserved and recording is blocked.'); return; }
  const key = e.kind === 'q-operating-v3' ? newKey : oldKey;
  try { if (sessionStorage.getItem(key) !== raw) throw Error('retained_work_changed'); sessionStorage.removeItem(key); }
  catch { setBlocked(true); setMessage('Outcome received, but retained work could not be cleared safely.'); return; }
  retained.current = null; setPending(null); setDisclosed(false); setNeedsRefresh(true);
  setMessage(checked.status === 'rejected' ? `Request rejected: ${label(checked.code ?? 'unknown')}. Refresh sources before another review.` : 'Selected schedule frozen. No money moved.');
  if (checked.status !== 'rejected') { try { await load(); } catch { setMessage('Receipt confirmed. Refresh sources before another review; current disclosure could not be loaded.'); } }
 }, [oldKey, newKey, load]);
 const reconcile = useCallback(async (e: Envelope, raw: string, isActive: () => boolean = () => true) => {
  const legacy = e.kind === 'q-operating-v2';
  const response = await fetch(`${legacy ? urlV2 : urlV3}/reconciliation`, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(legacy ? { operationId: e.operationId } : { operationId: e.operationId, request: e.request }) });
  const value: unknown = await response.json(); if (!isActive()) return true;
  if (!response.ok || !object(value) || Object.keys(value).sort().join() !== 'authorized,result' || value.authorized !== true) throw Error('reconciliation_unavailable');
  if (legacy) {
   // Its old reconciliation signature cannot prove the complete payload. Keep
   // the old request/key/route and require explicit exact replay to its writer.
   setMessage(value.result === null ? 'No completed legacy receipt. Retry only the exact retained legacy request.' : 'A legacy receipt exists. Exact legacy replay is required to validate its full request; nothing was cleared.'); return false;
  }
  if (value.result === null) { setMessage('No completed receipt. Retry only the exact retained request.'); return false; }
  await finish(raw, e, value.result); return true;
 }, [urlV2, urlV3, finish]);
 useEffect(() => {
  let active = true;
  void (async () => {
   try {
    const rows = [oldKey, newKey].map(key => ({ key, raw: sessionStorage.getItem(key) })).filter(r => r.raw !== null);
    if (!active) return;
    if (!rows.length) { setReady(true); setMessage('Review and disclose the exact selected schedule before recording it.'); return; }
    if (rows.length !== 1) { setBlocked(true); setReady(true); setMessage('Multiple retained policy requests exist. They were preserved; recording is blocked.'); return; }
    const { key, raw } = rows[0]; let e: unknown; try { e = JSON.parse(raw!); } catch { e = null; }
    if (!isOperatingEnvelope(e) || key !== (e.kind === 'q-operating-v3' ? newKey : oldKey)) { setBlocked(true); setReady(true); setMessage('Unrecognized or cross-version retained request. It was not overwritten.'); return; }
    retained.current = raw; setPending(e); setReady(true); setBusy(true); flight.current = true;
    try { await reconcile(e, raw!, () => active); } catch { if (active) setMessage('Reconciliation unavailable. The exact request remains retained.'); }
    finally { if (active) { flight.current = false; setBusy(false); } }
   } catch { if (active) { setBlocked(true); setReady(true); setMessage('Recovery storage unavailable. Recording is blocked.'); } }
  })();
  return () => { active = false; };
 }, [oldKey, newKey, reconcile]);
 async function submit(e: Envelope, retry = false) {
  if (flight.current || !ready || blocked) return;
  flight.current = true; setBusy(true);
  const key = e.kind === 'q-operating-v3' ? newKey : oldKey, url = e.kind === 'q-operating-v3' ? urlV3 : urlV2;
  try {
   if (!isOperatingEnvelope(e)) throw Error('invalid_request');
   let raw = retained.current;
   if (retry) {
    if (!pending || !raw || sessionStorage.getItem(key) !== raw || JSON.stringify(e) !== raw) { setBlocked(true); setMessage('Retained work changed. Recording is blocked.'); return; }
    if (e.kind === 'q-operating-v3' && await reconcile(e, raw)) return;
   } else {
    if (pending || sessionStorage.getItem(oldKey) !== null || sessionStorage.getItem(newKey) !== null) { setBlocked(true); setMessage('Other retained policy work exists. Nothing was overwritten.'); return; }
    raw = JSON.stringify(e); setAppRecoveryItem(sessionStorage, key, raw); retained.current = raw; setPending(e);
   }
   const response = await fetch(url, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'x-idempotency-key': e.operationId }, body: JSON.stringify(e.request) });
   await finish(raw!, e, await response.json());
  } catch { setMessage('Recording could not be confirmed. The exact request remains retained; no automatic retry will occur.'); }
  finally { flight.current = false; setBusy(false); }
 }
 const pools = source?.membership?.pools ?? [], selectedPool = pools.find(p => p.poolVersionId === poolId), selectedPolicy = source?.policies.find(p => p.poolVersionId === poolId);
 const illustrative = method === 'balanced' ? calculateAccWeightedPool({ paidCount: /^\d+$/.test(illustrativeCount) ? Number(illustrativeCount) : NaN, feeMinor: selectedPool?.feeMinor, ratio }) : null;
 const requestV3: QOperatingRequestV3 = { action: 'publish', poolVersionId: poolId, method: balancedQMethodV3, ratio, scheduleId: balancedQMethodV3, disclosureReference: reference.trim(), disclosed: true };
 const requestV2: QOperatingRequestV2 = { action: 'publish', poolVersionId: poolId, method: equalQMethodV2, ratio: null, scheduleId: null, disclosureReference: reference.trim(), disclosed: true };
 const locked = !ready || busy || blocked || !!pending || needsRefresh;
 const canPublish = !locked && source?.canPublish && disclosed && (method === 'balanced' ? illustrative?.status === 'calculated' && isQOperatingRequestV3(requestV3) : isQOperatingRequestV2(requestV2));
 const name = (id: string) => source?.membership?.entries.find(e => e.participantId === id)?.displayName ?? id;
 return <>
  <p role="status">{message}</p>
  <button type="button" disabled={!ready || busy || !!pending} onClick={async () => { if (flight.current) return; flight.current = true; setBusy(true); try { await load(); setMessage('Current policy sources refreshed.'); } catch { setNeedsRefresh(true); setMessage('Policy sources unavailable. Recording remains blocked.'); } finally { flight.current = false; setBusy(false); } }}>Refresh policy sources</button>
  <section className="correction-item"><h2>Director-selected Q policy</h2>
   <p>The graduated option uses the observed ACC calculator&apos;s raw weights with this app&apos;s fund-conserving $5 largest-remainder rounding. This is a disclosed app policy, not ACC endorsement or a universal ACC formula. Equal Q and regular playoff prizes are unchanged.</p>
   <p>Freeze the named pool fee, payout method and ratio before any election or payment. Announce the actual pool entrant count before play. Existing chart disclosures and unpaid history remain preserved; they are not recalculated as a new policy.</p>
   {!source && <p role="alert">Operating-schedule service unavailable. Recording and previews are blocked; saved history is unchanged.</p>}
   {source && <fieldset disabled={locked} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', minWidth: 0 }}><label>Named Q Pool<select value={poolId} onChange={e => { setPoolId(e.target.value); setDisclosed(false); }}>{pools.map(p => <option key={p.poolVersionId} value={p.poolVersionId}>{p.name} ({formatUsd(p.feeMinor)})</option>)}</select></label>
    {selectedPolicy ? <><p>Frozen method: {selectedPolicy.method === balancedQMethodV3 ? 'ACC raw weights with app balanced $5 rounding' : selectedPolicy.method === equalQMethodV2 ? 'Equal - paid playoff qualifiers' : 'Historical friend-supplied graduated chart'}{selectedPolicy.ratio ? `; 1 in ${selectedPolicy.ratio} paid pool entrants` : ''}.</p><p style={{ overflowWrap: 'anywhere' }}>Schedule: {selectedPolicy.scheduleId ?? 'Equal Q'}. Disclosure: {selectedPolicy.disclosureReference}. Published {selectedPolicy.publishedAt}.</p>{selectedPolicy.method !== balancedQMethodV3 && selectedPolicy.method !== equalQMethodV2 && <p>The preserved friend-supplied catalog covers 320 fee/ratio/count combinations, not a universal ACC formula. Schedule source: {qChartSchedules.find(s => s.id === selectedPolicy.scheduleId)?.label ?? 'Unavailable historical schedule - review required'}. Page 5 counts {qChartUserClarifiedPage5Counts.join(', ')} were clarified by the user and checked for payout count and total; the other 314 entries were visually transcribed.</p>}<p className="auth-note" style={{ overflowWrap: 'anywhere' }}>Policy {selectedPolicy.id}.</p></> : <>
     {!source.canPublish && <p role="alert">Publishing is blocked by scope, prior collection/consent, historical policy or play state. Existing records remain intact.</p>}
     <label>Payout method<select value={method} onChange={e => { setMethod(e.target.value as 'balanced' | 'equal'); setDisclosed(false); }}><option value="balanced">Graduated - ACC weights, app balanced $5 rounding</option><option value="equal">Equal - paid playoff qualifiers only</option></select></label>
     {method === 'balanced' ? <><p>Select ceil(fully paid entrants in this named pool / ratio) recipients by the existing Q card order, including paid nonqualifiers when needed. Unsupported cash ties block; mathematical remainder ties favor the higher finishing place and do not resolve a score tie.</p>
      <label>Paid-entry ratio<select value={ratio} onChange={e => { setRatio(Number(e.target.value) as 4 | 6); setDisclosed(false); }}><option value={6}>1 in 6 paid pool entrants</option><option value={4}>1 in 4 paid pool entrants</option></select></label>
      <label>Illustrative fully paid entrants<input inputMode="numeric" type="number" min={1} max={256} step={1} value={illustrativeCount} onChange={e => { setIllustrativeCount(e.target.value); setDisclosed(false); }}/></label>
      <p>This illustration does not freeze an entrant count or guaranteed dollar awards. The frozen formula is recalculated from actual valid full payments and finalized cards before unpaid review.</p>
      {illustrative?.status === 'calculated' ? <article><h3>Illustrative formula disclosure</h3><p>Fee {formatUsd(illustrative.feeMinor)}; {illustrative.paidCount} paid entrants; pot {formatUsd(illustrative.fundMinor)}; {illustrative.recipientCount} recipients; 1 in {illustrative.ratio}.</p><ol>{illustrative.awardsMinor.map((a, i) => <li key={i}>Place {i + 1}: {formatUsd(a)} total award.</li>)}</ol><p>Award sum {formatUsd(illustrative.awardsMinor.reduce((sum, n) => sum + n, 0))} equals pot {formatUsd(illustrative.fundMinor)}.</p></article> : <p role="alert">Graduated policy blocked: {label(illustrative?.code ?? 'unsupported_payout_domain')}. Supported fees are $10, $20 and $50; paid counts are 1–256. No interpolation, scaling or fallback is used.</p>}
      <p>Each recipient receives at least the pool fee. A single recipient receives the entire pot. Exact rational weights are floored to $5 units, then remaining $5 units follow largest remainders; a tied remainder favors the higher finishing place.</p>
     </> : <p>Equal Q continues to divide valid contributions among paid playoff qualifiers. Residual pennies follow finalized qualifying order. If nobody qualifies, contributions become unpaid refund obligations; no refund is executed.</p>}
     <label>Disclosure reference<input maxLength={500} value={reference} onChange={e => { setReference(e.target.value); setDisclosed(false); }}/></label>
     <label><input type="checkbox" checked={disclosed} onChange={e => setDisclosed(e.target.checked)}/>I reviewed and disclosed this exact named-pool fee, method, ratio and rounding before any election or payment and approve freezing it.</label>
     <button type="button" disabled={!canPublish} onClick={() => void submit(method === 'balanced' ? { kind: 'q-operating-v3', operationId: crypto.randomUUID(), request: requestV3 } : { kind: 'q-operating-v2', operationId: crypto.randomUUID(), request: requestV2 })}>Publish and freeze selected schedule</button>
    </>}
   </fieldset>}
   {pending && <button type="button" disabled={!ready || busy || blocked} onClick={() => void submit(pending, true)}>Retry exact operating-schedule request</button>}
  </section>
  <section className="correction-item"><h2>Read-only Q previews</h2><p>Actual current funding and finalized cards are required. Previews do not record obligations, mark anyone paid, execute refunds or finalize accounting. Use the separate source-bound unpaid review after checking these amounts.</p>
   {source && pools.map(pool => { const p = operatingPoolPreview(source, pool.poolVersionId); return <article key={pool.poolVersionId}><h3>{pool.name}</h3>{p.status === 'blocked' ? <p role="alert">Preview blocked: {label(p.code)}.</p> : <>
    {p.calculation && <p>Actual fee {formatUsd(p.calculation.feeMinor)}; {p.calculation.paidCount} fully paid entrants; 1 in {p.calculation.ratio}; {p.calculation.recipientCount} recipients. App balanced $5 rounding; higher-place remainder priority.</p>}
    <p>Valid pool contributions: {formatUsd(p.fundMinor)}.</p><h4>{p.refunds.length ? 'Unpaid refund obligations - not executed' : 'Proposed awards - not paid'}</h4><ul>{[...p.awards, ...p.refunds].map(a => <li key={a.participantId}>{name(a.participantId)}: {formatUsd(a.amountMinor)}</li>)}</ul><p>Award/refund sum {formatUsd([...p.awards, ...p.refunds].reduce((sum, a) => sum + a.amountMinor, 0))} equals pot {formatUsd(p.fundMinor)}.</p>
   </>}</article>; })}
   <p>Actual disbursement remains disabled. Q-only cash ties do not acquire a new sporting tiebreak from the rounding policy.</p>
  </section>
  {source?.cuts.length ? <section className="correction-item"><h2>Preserved historical cut evidence</h2><p>Earlier source-bound cut records remain in history. They do not resolve a new balanced-method Q cash tie.</p><ul>{source.cuts.map((cut, i) => <li key={i} style={{ overflowWrap: 'anywhere' }}>{cut.reason} - source {cut.sourceDigest}</li>)}</ul></section> : null}
  {source && <p className="auth-note" style={{ overflowWrap: 'anywhere' }}>Source snapshot {source.sourceDigest}.</p>}
 </>;
}
