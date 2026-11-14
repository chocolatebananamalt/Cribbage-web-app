import type { PlayoffSeriesEntryViewV1, PlayoffSeriesEntryStatusV1 } from '../../components/playoff-series-entry-v1';
import type { SeriesGameEntrySnapshotV1, SeriesGameOfflineControllerV1 } from './series-game-offline-v1';
import { isSeriesGameClientWorkspaceV1 } from './series-game-client-transport-v1.ts';
import { projectSeriesGameLoadedV1 } from './series-game-protocol-v1.ts';

export type SeriesGameEntryNamesV1 = {
 tournamentId: string; eventId: string; generationId: string;
 players: [{ participantId: string; displayName: string }, { participantId: string; displayName: string }];
};
export type SeriesGameEntryCapabilitiesV1 = ReturnType<SeriesGameOfflineControllerV1['getCapabilities']>;
/** Presentation projection only. Names must come from the same trusted match source.
 * Cached wins are explicitly last-checked, never current verification. */
export function projectSeriesGameEntryViewV1(
 snapshot: SeriesGameEntrySnapshotV1 | null,
 names: SeriesGameEntryNamesV1 | null,
 capabilities: SeriesGameEntryCapabilitiesV1,
): PlayoffSeriesEntryViewV1 | null {
 if (!snapshot || !names || !snapshot.context.enabled || !snapshot.initialized) return null;
 const c = snapshot.context, w = c.workspace;
 if (!isSeriesGameClientWorkspaceV1(w, c.actorProfileId)) return null;
 const b = w.loaded.binding;
 if (b.tournamentId !== c.tournamentId || b.eventId !== c.eventId || names.tournamentId !== b.tournamentId || names.eventId !== b.eventId || names.generationId !== b.generationId || !Array.isArray(names.players) || names.players.length !== 2 || names.players.some(p => !p || typeof p !== 'object' || typeof p.participantId !== 'string' || typeof p.displayName !== 'string')) return null;
 const q = projectSeriesGameLoadedV1(w.loaded, c.actorProfileId);
 if (q.status !== 'projected_series_game_workspace') return null;
 const players = q.players.map(p => names.players.find(n => n.participantId === p.participantId));
 if (players.some(p => !p || typeof p.displayName !== 'string' || !p.displayName.trim() || p.displayName.length > 500 || /[\u0000-\u001f\u007f]/.test(p.displayName)) || names.players[0].participantId === names.players[1].participantId) return null;

 const current = c.online && c.workspaceFresh;
 const pending = snapshot.hasUnresolvedStorage || snapshot.pending !== null;
 const reviewing = pending && snapshot.reviewing && snapshot.receiptStatus === 'rejected' && c.online && c.workspaceFresh && snapshot.freshAfterPending;
 let status: PlayoffSeriesEntryStatusV1 = 'ready';
 if (snapshot.storageBlocked) status = 'storage_blocked';
 else if (pending && !reviewing) status = snapshot.receiptStatus === 'rejected' ? 'rejected' : !c.online && snapshot.receiptStatus === null ? 'pending_offline' : 'unknown_outcome';
 else if (!current && c.online) status = 'source_changed';
 else if (!current && q.series.complete) status = 'source_changed';
 else if (q.series.complete) status = 'series_complete';
 else if (q.currentGame.status === 'conflicted') status = 'conflicted';
 else if (q.currentGame.ownSubmission) status = q.currentGame.ownConfirmedSubmissionOperationId === q.currentGame.ownSubmission.operationId ? 'waiting_opponent' : 'saved_awaiting_confirmation';
 const author = !snapshot.busy && !snapshot.storageBlocked && (!pending || reviewing) && (c.online ? c.workspaceFresh : c.offlineAuthoringReady) && !q.series.complete;
 const selected = q.players.some(p => p.participantId === snapshot.selection) ? snapshot.selection : null;
 const own = q.currentGame.ownSubmission?.winnerParticipantId ?? null;
 return {
  actorParticipantId: q.actorParticipantId, players: players as SeriesGameEntryNamesV1['players'],
  roundLabel: b.round === 'final' ? 'Final' : b.round === 'semifinal' ? 'Semifinal' : 'Regular Round', matchLabel: `Match ${b.slot}`,
  gameNumber: q.currentGame.gameNumber, winsRequired: q.format.winsRequired, maximumGames: q.format.maximumGames,
  seriesWins: [...q.series.wins], cachedState: !current, status, selectedWinnerParticipantId: selected, ownSubmittedWinnerParticipantId: own,
  canSubmit: author && capabilities.canSubmit, canConfirm: author && capabilities.canConfirm && (selected === null || selected === own),
  canRetry: capabilities.canRetry, canCheckOutcome: capabilities.canCheckOutcome, canRefresh: capabilities.canRefresh,
  canReviewSaved: capabilities.canReviewSaved, canKeepCopy: capabilities.canKeepCopy, busy: snapshot.busy,
  message: [snapshot.message, !current ? 'Saved match information is last checked, not current verification. Only a fresh online server read can verify a game.' : ''].filter(Boolean).join(' '),
 };
}
