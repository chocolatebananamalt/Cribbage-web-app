"use client";
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { EventFinanceSectionV1 } from './event-finance-section-v1';
import type { FinanceLocalDraftSessionV1 } from '../lib/finance/event-finance-draft-session-v1';
import type { EventFinanceDraftScopeV1 } from '../lib/finance/event-finance-draft-codec-v1';
import styles from './event-finance-recovered-section-v1.module.css';
export type EventFinanceRecoveredSectionPropsV1 = {
 enabled?: boolean; scope: EventFinanceDraftScopeV1; session: FinanceLocalDraftSessionV1 | null;
 preparedSource: unknown; sourceEpoch: string;
};
const statusCopy = {
 inactive: 'Device Draft Inactive', checking: 'Checking Device Recovery', unsaved: 'Not Saved on This Device',
 device_saved_current: 'Current Proposal Copy Saved on This Device', device_saved_older: 'An Older Proposal Copy Is Saved on This Device',
 outcome_unknown: 'Device Save Outcome Not Yet Known', conflict: 'Device Draft Conflict — Review Required',
 storage_blocked: 'Device Recovery Is Unavailable', source_unavailable: 'Finance Source Is Unavailable',
} as const;
/** Caller-supplied fixed-account session only. No storage factory, transport,
 * server save, remote route, authentication selection or automatic cleanup. */
export function EventFinanceRecoveredSectionV1(props: EventFinanceRecoveredSectionPropsV1) {
 if (!props.enabled || !props.session || !props.session.matchesScope(props.scope)) return <section className={styles.panel} aria-label="Finance Device Recovery"><h2>Finance Device Recovery</h2><p role="status">Device draft editing is unavailable. No financial data is shown or saved here.</p></section>;
 const scopeKey = `${props.scope.actorId}:${props.scope.tournamentId}:${props.scope.eventId}`;
 return <Connected key={scopeKey} {...props} session={props.session} scopeKey={scopeKey} />;
}
function Connected({ session, scope, scopeKey, preparedSource, sourceEpoch }: EventFinanceRecoveredSectionPropsV1 & { session: FinanceLocalDraftSessionV1; scopeKey: string }) {
 const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, () => null);
 const owner = useMemo(() => ({ session, scopeKey }), [session, scopeKey]);
 const activeOwner = useRef<typeof owner | null>(null);
 useLayoutEffect(() => {
  activeOwner.current = owner;
  session.setActive(true);
  return () => {
   if (activeOwner.current !== owner) return;
   activeOwner.current = null;
   session.setActive(false);
  };
 }, [session, owner]);
 useLayoutEffect(() => {
  session.updateSource(preparedSource);
  void session.initialize();
 }, [session, preparedSource, sourceEpoch]);
 const matching = session.matchesScope(scope);
 const run = (action: () => void | Promise<void>) => {
  if (matching && snapshot && activeOwner.current === owner && session.matchesScope(scope) && session.getSnapshot() === snapshot) void action();
 };
 if (!matching || !snapshot) return <section className={styles.panel} aria-label="Finance Device Recovery"><h2>Finance Device Recovery</h2><p role="status">Checking the matching finance session. No proposal can be edited yet.</p></section>;
 const status = Object.hasOwn(statusCopy, snapshot.status) ? statusCopy[snapshot.status] : 'Device Draft Status Unavailable';
 return <section aria-label="Finance with Device Recovery">
  <div className={styles.panel}>
   <h2>Device Draft Recovery</h2>
   <p className={styles.notice}>This saves a proposal copy on this device only. It does not save the tournament ledger, approve a payout, record a payment, or sync to another device.</p>
   <div role="status" aria-live="polite"><h3>{status}</h3>{snapshot.busy && <p>Checking or saving the device copy. Keep this page open.</p>}{snapshot.message && <p>{snapshot.message}</p>}</div>
   <dl className={styles.facts}><dt>Device Clock — Last Checked Saved Copy</dt><dd>{snapshot.deviceSavedAt ?? 'Not available'}</dd><dt>Local Draft Revision</dt><dd>{snapshot.deviceRevision ?? 'Not available'}</dd></dl>
   <p>The device clock is not a server timestamp or ledger receipt. Even a saved device copy remains a financial proposal.</p>
   <div className={styles.actions} aria-label="Device Draft Actions">
    <button type="button" disabled={!snapshot.canSave || snapshot.busy} onClick={() => { if (snapshot.canSave && !snapshot.busy) run(() => session.save(snapshot)); }}>Save Draft on This Device</button>
    <button type="button" disabled={!snapshot.canCheck || snapshot.busy} onClick={() => { if (snapshot.canCheck && !snapshot.busy) run(() => session.check(snapshot)); }}>Check Saved Device Copy</button>
    {snapshot.canRetry && <button type="button" disabled={snapshot.busy} onClick={() => { if (!snapshot.busy) run(() => session.retry(snapshot)); }}>Retry Same Device Save</button>}
   </div>
   {!snapshot.view && <p>Current finance information is unavailable. No totals are inferred and retained work is not discarded.</p>}
  </div>
  <EventFinanceSectionV1 enabled view={snapshot.view} onAction={(action, expectedView) => {
   if (snapshot.view === expectedView) run(() => { session.dispatch(action, expectedView); });
  }} />
 </section>;
}
