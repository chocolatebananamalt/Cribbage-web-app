"use client";
import styles from './playoff-series-entry-v1.module.css';
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { PlayoffSeriesEntryV1, type PlayoffSeriesEntryCommandsV1 } from './playoff-series-entry-v1';
import type { SeriesGameEntryContextV1, SeriesGameOfflineControllerV1 } from '../lib/playoffs/series-game-offline-v1';
import { projectSeriesGameEntryViewV1, type SeriesGameEntryNamesV1 } from '../lib/playoffs/series-game-entry-view-v1';
export type PlayoffSeriesEntryConnectedPropsV1 = {
 enabled?: boolean; controller: SeriesGameOfflineControllerV1 | null;
 context: SeriesGameEntryContextV1; contextEpoch: string; names: SeriesGameEntryNamesV1 | null;
};
const noCommands: PlayoffSeriesEntryCommandsV1 = { selectWinner: () => {}, submitResult: () => {}, confirmOwnEntry: () => {}, retryExact: () => {}, checkOutcome: () => {}, refresh: () => {} };
/** Injected adapter only: no default transport, storage, route or authority. */
export function PlayoffSeriesEntryConnectedV1(props: PlayoffSeriesEntryConnectedPropsV1) {
 if (!props.enabled || !props.context.enabled || !props.controller) return <PlayoffSeriesEntryV1 view={null} commands={noCommands} />;
 return <Connected key={props.contextEpoch} {...props} controller={props.controller} />;
}
function Connected({ controller, context, contextEpoch, names }: PlayoffSeriesEntryConnectedPropsV1 & { controller: SeriesGameOfflineControllerV1 }) {
 const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => null);
 const owner = useMemo(() => ({ controller, contextEpoch }), [controller, contextEpoch]);
 const activeOwner = useRef<typeof owner | null>(null);
 useLayoutEffect(() => {
  activeOwner.current = owner;
  return () => {
   if (activeOwner.current !== owner) return;
   activeOwner.current = null;
   // The controller is caller-owned; invalidate without permanently disposing it.
   controller.updateContext({ ...controller.getSnapshot().context, enabled: false });
  };
 }, [controller, owner]);
 useLayoutEffect(() => {
  controller.updateContext({ ...context, enabled: true });
  void controller.initialize();
 }, [controller, context, contextEpoch]);
 const matches = !!snapshot && snapshot.context.enabled && snapshot.context.actorProfileId === context.actorProfileId && snapshot.context.tournamentId === context.tournamentId && snapshot.context.eventId === context.eventId;
 const caps = controller.getCapabilities();
 const view = projectSeriesGameEntryViewV1(matches ? snapshot : null, names, caps);
 // Every callback belongs to this exact rendered snapshot and mounted owner.
 const run = (action: () => void | Promise<void>) => {
  if (matches && activeOwner.current === owner && controller.getSnapshot() === snapshot) void action();
 };
 const commands: PlayoffSeriesEntryCommandsV1 = {
  selectWinner: id => run(() => controller.selectWinner(id)), submitResult: () => run(() => controller.submitResult()),
  confirmOwnEntry: () => run(() => controller.confirmOwnEntry()), retryExact: () => run(() => controller.retryExact()),
  checkOutcome: () => run(() => controller.checkOutcome()), refresh: () => run(() => controller.refresh()),
  reviewSaved: () => run(() => controller.reviewSaved()), keepCopyAndContinue: () => run(() => controller.keepCopyAndContinue()),
 };
 if (!view && matches && snapshot.initialized && (snapshot.pending || snapshot.hasUnresolvedStorage || snapshot.storageBlocked)) return <section className={styles.panel} aria-label="Saved Entry Recovery">
  <h2>Saved Entry Recovery</h2><p role="status">Current player and score information is unavailable. Your saved work has not been discarded.</p>
  {snapshot.message && <p>{snapshot.message}</p>}
  <div className={styles.recovery}>{caps.canCheckOutcome && <button type="button" disabled={snapshot.busy} onClick={commands.checkOutcome}>Check Saved Entry</button>}
  {caps.canRefresh && <button type="button" disabled={snapshot.busy} onClick={commands.refresh}>Refresh Match</button>}
  {caps.canKeepCopy && <button type="button" disabled={snapshot.busy} onClick={commands.keepCopyAndContinue}>Keep Saved Copy and Continue</button>}
  </div></section>;
 return <PlayoffSeriesEntryV1 enabled view={view} commands={commands} />;
}
