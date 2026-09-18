// The score entry component had no test of any kind, which is how the two
// defects below survived. Both are asserted against the source, because the
// suite has no React renderer; the assertions are written to fail if the
// specific mechanism is removed, not merely if a word disappears.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const file = 'src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx';
const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('the source really is the score entry component', () => {
  assert.match(source, /export function LiveScoreEntry/);
  assert.match(source, /const \[canConfirm, setCanConfirm\] = useState\(context\.canConfirm\)/);
});

test('canConfirm follows the server instead of the value captured at first mount', () => {
  // router.refresh() re-renders with fresh props but does not remount, so a
  // useState initializer alone leaves the second submitter without a Confirm
  // button and the game never reaches verified. An effect keyed on
  // context.canConfirm is what keeps the button in step with the server.
  // Adjusted during render rather than in an effect, which is what React
  // documents for a changed prop and what react-hooks/set-state-in-effect
  // requires here. Either mechanism is acceptable; what must not happen is
  // canConfirm being left at its first-mount value.
  assert.match(source, /if \(lastServerCanConfirm !== context\.canConfirm\) \{/,
    'the component must notice when the server changes canConfirm');
  const adjust = source.slice(source.indexOf('if (lastServerCanConfirm !== context.canConfirm) {'));
  assert.match(adjust.slice(0, 300), /setCanConfirm\(context\.canConfirm\)/,
    'noticing the change must actually update canConfirm');
});

test('offline sync copy does not promise a retry that never happens', () => {
  // Nothing drains the queue on a timer. The only triggers are the Sync button,
  // a page reload, and the reconnect handler, so promising an automatic retry
  // leaves a queued score sitting while the player waits for it.
  assert.doesNotMatch(source, /retry when service returns/i,
    'the offline failure message must not promise an automatic retry');
  assert.match(source, /Tap Sync Saved Entry to try again/,
    'the offline failure message must name the action that actually works');
  assert.doesNotMatch(source, /setInterval|setTimeout\([^)]*syncOffline/,
    'if an automatic retry is ever added, update this test and the copy together');
});

test('a discarded offline entry tells the player it is gone and must be re-entered', () => {
  // On rejected, quarantined and conflict the local record is deleted, and the
  // server kept only a digest and a signature, so no winner or margin survives
  // anywhere. Saying it awaits official review implies something recoverable.
  for (const outcome of ['recorded a conflict', 'quarantined this offline entry', 'rejected this offline entry']) {
    const index = source.indexOf(outcome);
    assert.ok(index > 0, `expected the ${outcome} message`);
    const message = source.slice(index, index + 260);
    assert.match(message, /this device no longer holds it/,
      `the ${outcome} message must say the local copy is gone`);
    assert.match(message, /Re-enter the result from the paper card/,
      `the ${outcome} message must tell the player how to recover`);
  }
});
