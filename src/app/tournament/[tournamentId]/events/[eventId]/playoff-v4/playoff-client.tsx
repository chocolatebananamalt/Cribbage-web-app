"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { isPlayoffV4Request, isPlayoffV4Result, isPlayoffV4Workspace, isPlayoffV4Reconciliation, playoffV4ResultMatches, type PlayoffV4Request, type PlayoffV4Workspace, type PlayoffV4Outcome } from '../../../../../../lib/api/playoff-outcome-v4';
import { deriveFiveQualifierPlayoff, type PlayedSeries } from '../../../../../../lib/results/five-qualifier-playoff';
import { setAppRecoveryItem } from '../../../../../../lib/recovery-write-coordinator';
import type { SyntheticEventContext } from '../../../../../../lib/api/synthetic-event-evidence';
import { SyntheticEventArtifactView } from '../../../../../../components/synthetic-event-notice';

type Envelope = { kind: 'playoff-v4'; operationId: string; request: PlayoffV4Request };
const validEnvelope = (v: unknown): v is Envelope => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join() === 'kind,operationId,request' && (v as Envelope).kind === 'playoff-v4' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test((v as Envelope).operationId) && isPlayoffV4Request((v as Envelope).request);
const blank = (): PlayedSeries[] => Array.from({ length: 4 }, () => ({ winnerId: '', loserId: '', evidenceNote: '' }));
const label = (s: string) => s.replaceAll('_', ' ');
export default function FiveQualifierPlayoffClient({ actorId, tournamentId, eventId, initialWorkspace, syntheticContext: tournamentSyntheticContext }: { actorId: string; tournamentId: string; eventId: string; initialWorkspace: PlayoffV4Workspace | null; syntheticContext?: SyntheticEventContext | null }) {
  const syntheticContext = tournamentSyntheticContext?.eventIds.includes(eventId) ? tournamentSyntheticContext : null;

 const key = `payment-obligation:playoff-v4:${actorId}:${tournamentId}:${eventId}`, url = `/api/v1/tournaments/${tournamentId}/events/${eventId}/playoff-v4`;
 const [workspace, setWorkspace] = useState(initialWorkspace), [series, setSeries] = useState(initialWorkspace?.result?.series ?? blank());
 const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [needsRefresh, setNeedsRefresh] = useState(false);
 const [pending, setPending] = useState<Envelope | null>(null), [message, setMessage] = useState('Checking retained playoff work.'), [reason, setReason] = useState(''), [reviewed, setReviewed] = useState(false);
 const flight = useRef(false), retained = useRef<string | null>(null);
 const load = useCallback(async () => {
  const response = await fetch(url, { cache: 'no-store' }), data: unknown = await response.json();
  if (!response.ok || !isPlayoffV4Workspace(data, tournamentId, eventId)) throw Error('playoff_unavailable');
  setWorkspace(data); setSeries(data.result?.series ?? blank()); setReviewed(false); setNeedsRefresh(false);
 }, [url, tournamentId, eventId]);
 const finish = useCallback(async (raw: string, operation: Envelope, value: unknown) => {
  if (!isPlayoffV4Result(value, tournamentId, eventId) || !playoffV4ResultMatches(value, operation.request)) { setMessage('Outcome remains uncertain. The exact playoff request is retained.'); return; }
  if (value.status === 'rejected' && value.code === 'idempotency_conflict') { setBlocked(true); setMessage('Operation identity conflict. Retained work is preserved; recording is blocked.'); return; }
  try { if (sessionStorage.getItem(key) !== raw) throw Error('retained_work_changed'); sessionStorage.removeItem(key); }
  catch { setBlocked(true); setMessage('Outcome received, but retained playoff work could not be cleared safely.'); return; }
  retained.current = null; setPending(null); setNeedsRefresh(true); setReviewed(false);
  setMessage(value.status === 'rejected' ? `Playoff request rejected: ${label(value.code)}. Refresh sources before another save.` : syntheticContext ? 'Four simulated series recorded. No physical matches are claimed; three bye credits and qualifying scores stay separate.' : 'Four played series recorded. Three bye credits remain separate; qualifying scores are unchanged.');
  if (value.status !== 'rejected') { try { await load(); } catch { setMessage('Playoff receipt confirmed. Current sources could not be loaded; refresh before another save.'); } }
 }, [tournamentId, eventId, key, load, syntheticContext]);
 const reconcile = useCallback(async (operation: Envelope, raw: string, isActive: () => boolean = () => true) => {
  const response = await fetch(`${url}/reconciliation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId: operation.operationId, request: operation.request }) });
  const data: unknown = await response.json();
  if (!isActive()) return true;
  if (!response.ok || !isPlayoffV4Reconciliation(data, tournamentId, eventId)) throw Error('reconciliation_unavailable');
  if (data.result === null) { setMessage('No completed playoff receipt. Retry only the exact retained request.'); return false; }
  await finish(raw, operation, data.result); return true;
 }, [url, tournamentId, eventId, finish]);
 useEffect(() => {
  let active = true;
  void (async () => {
   try {
    const raw = sessionStorage.getItem(key); if (!active) return;
    if (!raw) { setReady(true); setMessage('Review four played series and the three first-round byes.'); return; }
    let operation: unknown; try { operation = JSON.parse(raw); } catch { operation = null; }
    if (!validEnvelope(operation)) { setBlocked(true); setReady(true); setMessage('Unrecognized retained playoff work. It was preserved and recording is blocked.'); return; }
    retained.current = raw; setPending(operation); setSeries(operation.request.series); setReason(operation.request.reason); setReady(true); flight.current = true; setBusy(true);
    try { await reconcile(operation, raw, () => active); } catch { if (active) setMessage('Reconciliation unavailable. The exact playoff request remains retained.'); }
    finally { if (active) { flight.current = false; setBusy(false); } }
   } catch { if (active) { setBlocked(true); setReady(true); setMessage('Recovery storage unavailable. Playoff recording is blocked.'); } }
  })();
  return () => { active = false; };
 }, [key, reconcile]);
 async function send(request: PlayoffV4Request, retry = false) {
  if (flight.current || blocked || !ready) return;
  flight.current = true; setBusy(true);
  try {
   const operation: Envelope = retry && pending ? pending : { kind: 'playoff-v4', request, operationId: crypto.randomUUID() };
   if (!validEnvelope(operation) || pending && !retry) throw Error('pending_work');
   let raw = retained.current;
   if (retry) {
    if (!pending || !raw || sessionStorage.getItem(key) !== raw || JSON.stringify(operation) !== raw) { setBlocked(true); setMessage('Retained playoff work changed. Recording is blocked.'); return; }
    if (await reconcile(operation, raw)) return;
   } else {
    if (sessionStorage.getItem(key) !== null) { setBlocked(true); setMessage('Other retained playoff work exists. It was not overwritten.'); return; }
    raw = JSON.stringify(operation); setAppRecoveryItem(sessionStorage, key, raw); retained.current = raw; setPending(operation);
   }
   const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-idempotency-key': operation.operationId }, body: JSON.stringify(operation.request) });
   await finish(raw!, operation, await response.json());
  } catch { setMessage('Recording could not be confirmed. The exact playoff request remains retained; no automatic retry will occur.'); }
  finally { flight.current = false; setBusy(false); }
 }
 const qualifiers = workspace?.qualifiers ?? [], ids = qualifiers.map(q => q.participantId), names = new Map(qualifiers.map(q => [q.participantId, q.displayName]));
 const pairs = [[ids[3], ids[4]], [ids[0], series[0].winnerId], [ids[2], ids[1]], [series[1].winnerId, series[2].winnerId]];
 const locked = !ready || busy || blocked || pending !== null || needsRefresh || !workspace?.canRecord;
 const changeWinner = (index: number, winnerId: string) => {
  const pair = pairs[index], next = series.map(s => ({ ...s }));
  next[index] = { ...next[index], winnerId, loserId: pair.find(id => id && id !== winnerId) ?? '' };
  if (index === 0) next[1] = { ...next[1], winnerId: '', loserId: '' };
  if (index < 3) next[3] = { ...next[3], winnerId: '', loserId: '' };
  setSeries(next); setReviewed(false);
 };
 const playoffArtifact = syntheticContext?.artifacts.find(item => item.kind === 'playoff' && item.eventId === eventId && item.sourceDigest === workspace?.sourceDigest && item.payload.qualificationResultVersionId === workspace?.qualificationResultVersionId && item.payload.expectedVersion === workspace?.currentVersion && item.payload.sourceDigest === workspace?.sourceDigest && Array.isArray(item.payload.series) && item.payload.series.length === 4 && item.payload.series.every(plan => !!plan && typeof plan === 'object' && typeof (plan as Record<string, unknown>).winnerId === 'string' && typeof (plan as Record<string, unknown>).loserId === 'string'));
 let preview: PlayoffV4Outcome[] | null = null;
 const previewSeries = syntheticContext && playoffArtifact ? series.map((row, i) => ({ ...row, evidenceNote: `${playoffArtifact.reference}:${i + 1}` })) : series;
 try { preview = deriveFiveQualifierPlayoff(qualifiers.map(({ participantId, qualificationRank, gamePoints }) => ({ participantId, qualificationRank, gamePoints })), previewSeries); } catch { /* Incomplete or unsupported evidence is never a recording authority. */ }
 const plannedSeriesMatch = !!playoffArtifact && series.every((row, i) => (playoffArtifact.payload.series as Array<Record<string, unknown>>)[i]?.winnerId === row.winnerId && (playoffArtifact.payload.series as Array<Record<string, unknown>>)[i]?.loserId === row.loserId);
 const canSave = !locked && preview !== null && reviewed && reason.trim().length > 0 && (!syntheticContext || (!!playoffArtifact && plannedSeriesMatch));
 const request = (): PlayoffV4Request => ({ qualificationResultVersionId: workspace!.qualificationResultVersionId!, expectedVersion: workspace!.currentVersion, sourceDigest: workspace!.sourceDigest!, series: syntheticContext && playoffArtifact ? series.map((row, i) => ({ ...row, evidenceNote: `${playoffArtifact.reference}:${i + 1}` })) : series, reason: syntheticContext && playoffArtifact ? `TEST ONLY SYNTHETIC: ${playoffArtifact.reference} ${reason.trim()}` : reason.trim(), reviewed: true });
 function rows(outcomes: PlayoffV4Outcome[]) { return <ul>{outcomes.map(r => <li key={r.participantId}>{names.get(r.participantId) ?? 'Recorded qualifier'}: finishing band {r.bandStart === r.bandEnd ? r.bandStart : `${r.bandStart}-${r.bandEnd}`}; {r.playedMatchWins} played series wins, {r.byeWins} bye credits; MRP {r.qualifyingMrp} qualifying + {r.playoffMrp} playoff = {r.totalMrp}.</li>)}</ul>; }
 return <section className="correction-item" aria-labelledby="five-playoff"><h2 id="five-playoff">Five-qualifier playoff</h2>
  <p>Seeds 1, 2 and 3 receive a first-round bye. A bye earns published MRP credit but is not a played game or a qualifying-score change. Only four played series are recorded. Regular prizes and Q Pools remain separate.</p>
  <p role="status">{message}</p>
  <button type="button" disabled={!ready || busy || pending !== null} onClick={async () => { if (flight.current) return; flight.current = true; setBusy(true); try { await load(); setMessage('Current qualification sources refreshed.'); } catch { setNeedsRefresh(true); setMessage('Qualification sources unavailable. Recording remains blocked.'); } finally { flight.current = false; setBusy(false); } }}>Refresh playoff sources</button>
  {pending && <p><button type="button" disabled={busy || blocked} onClick={() => void send(pending.request, true)}>Retry exact playoff request</button></p>}
  {!workspace ? <p role="alert">Playoff service unavailable. Existing records are unchanged.</p> : <>
   {workspace.blocker && <p role="alert">Recording blocked: {label(workspace.blocker)}.</p>}
   <h3>Finalized qualifying cards</h3><ol>{qualifiers.map(q => <li key={q.participantId}>{q.displayName}: seed {q.qualificationRank}, {q.gamePoints} game points{q.byeWins ? ', first-round bye' : ', plays round 1'}.</li>)}</ol>
   {playoffArtifact && <SyntheticEventArtifactView artifact={playoffArtifact}/>} {syntheticContext && !playoffArtifact && <p role="alert">Synthetic playoff recording is blocked. No current artifact matches this source and qualification version.</p>} {syntheticContext && playoffArtifact && !plannedSeriesMatch && series.some(row => row.winnerId) && <p role="alert">Your selections must match the source-bound simulated series before recording.</p>}
   <fieldset disabled={locked || (!!syntheticContext && !playoffArtifact)} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", minWidth: 0 }}><legend>{syntheticContext ? 'Review four simulated series' : 'Record the four played series'}</legend>{['Round 1: seed 4 versus seed 5', 'Semifinal: seed 1 versus round 1 winner', 'Semifinal: seed 3 versus seed 2', 'Final: the two semifinal winners'].map((title, i) => <div key={title}><h3>{title}</h3><label>Winner of series {i + 1}<select value={series[i].winnerId} disabled={locked || pairs[i].some(id => !id)} onChange={e => changeWinner(i, e.target.value)}><option value="">Select the {syntheticContext ? 'simulated' : 'recorded'} winner</option>{pairs[i].filter(Boolean).map(id => <option key={id} value={id}>{names.get(id)}</option>)}</select></label>{!syntheticContext && <label>Evidence for series {i + 1}<input maxLength={200} value={series[i].evidenceNote} onChange={e => { setSeries(s => s.map((row, j) => j === i ? { ...row, evidenceNote: e.target.value } : row)); setReviewed(false); }}/></label>}</div>)}
   <label>Playoff review reason<input maxLength={500} value={reason} onChange={e => { setReason(e.target.value); setReviewed(false); }}/></label>
   <label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/>{syntheticContext ? 'I reviewed these four simulated results; no physical games were played.' : 'I reviewed the four played results, separate bye credits and unchanged qualifying scores.'}</label>
   <button type="button" disabled={!canSave} onClick={() => void send(request())}>Record five-qualifier playoff</button></fieldset>
   {preview && <><h3>Calculated preview</h3>{rows(preview)}</>}
   {workspace.result && <article><h3>Recorded playoff version {workspace.result.version}</h3><p>{workspace.result.current ? 'Matches current qualification evidence.' : 'Recorded evidence is stale. History is preserved; it cannot authorize accounting.'}</p><p>{workspace.result.request.reason}</p>{rows(workspace.result.outcomes)}</article>}
  </>}
 </section>;
}
