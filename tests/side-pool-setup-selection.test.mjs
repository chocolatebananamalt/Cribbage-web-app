import test from 'node:test';
import assert from 'node:assert/strict';
import { isGraduatedSidePoolSetupType, nextSidePoolDefaultName, sidePoolDefaultName, sidePoolNameFromInput, sidePoolOptionalName, sidePoolSetupRatio } from '../src/lib/api/side-pool-setup-selection.ts';

test('only supported graduated selections yield a payout ratio', () => {
  for (const ratio of [4, 6, 8, 10]) {
    const code = `graduated-1-in-${ratio}`;
    assert.equal(isGraduatedSidePoolSetupType(code), true);
    assert.equal(sidePoolSetupRatio(code), ratio);
  }
  for (const code of [undefined, null, '', 'equal', 'equal-double', 'graduated-1-in-5', 'Side Pool 1']) {
    assert.equal(isGraduatedSidePoolSetupType(code), false);
    assert.equal(sidePoolSetupRatio(code), null);
  }
});

test('optional names generate distinct bounded identities while retaining entered names', () => {
  assert.deepEqual(Array.from({length: 6}, (_, index) => sidePoolNameFromInput('', index)), ['Side Pool 1', 'Side Pool 2', 'Side Pool 3', 'Side Pool 4', 'Side Pool 5', 'Side Pool 6']);
  assert.equal(sidePoolOptionalName('Side Pool 2', 1), '');
  assert.equal(sidePoolNameFromInput('  Early Bird  ', 0), '  Early Bird  ');
  assert.equal(sidePoolOptionalName('Early Bird', 0), 'Early Bird');
  assert.equal(nextSidePoolDefaultName(['Side Pool 2']), 'Side Pool 1');
  assert.equal(nextSidePoolDefaultName(['side pool 1', 'Side Pool 2']), 'Side Pool 3');
  assert.throws(() => sidePoolDefaultName(-1), RangeError);
  assert.throws(() => sidePoolDefaultName(6), RangeError);
});
