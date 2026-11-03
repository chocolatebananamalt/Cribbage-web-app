"use client";

import type { ReactNode } from 'react';
import { isGraduatedSidePoolSetupType, sidePoolNameFromInput, sidePoolOptionalName, type SidePoolSetupSelection } from '../lib/api/side-pool-setup-selection';

type Props = {
  pool: SidePoolSetupSelection;
  index: number;
  update: (value: SidePoolSetupSelection) => void;
  remove: () => void;
  /** Existing validated $5-increment money input is supplied by the setup form. */
  feeInput: ReactNode;
  supportedFormat: boolean;
};

export function SetupSidePoolEditor({ pool, index, update, remove, feeInput, supportedFormat }: Props) {
  return <fieldset className="setup-subsection"><legend>Side Pool {index + 1}</legend>
    <label>Payout type<select required disabled={!supportedFormat} value={pool.payoutType ?? ''} onChange={(event) => {
      if (isGraduatedSidePoolSetupType(event.target.value)) update({ ...pool, payoutType: event.target.value });
    }}>
      <option value="">Select a Side Pool type</option>
      <option value="graduated-1-in-4">Graduated (1-in-4)</option>
      <option value="graduated-1-in-6">Graduated (1-in-6)</option>
      <option value="graduated-1-in-8">Graduated (1-in-8)</option>
      <option value="graduated-1-in-10">Graduated (1-in-10)</option>
      <option value="equal" disabled>Equal (not yet available)</option>
      <option value="equal-double" disabled>Equal, top paid double (not yet available)</option>
    </select></label>
    {!supportedFormat && <p className="field-help">Graduated Side Pool payouts currently require Standard Singles scoring. Remove this pool or choose a supported event format before saving.</p>}
    {!pool.payoutType && <p className="field-help">New Side Pools need a payout type. An unchanged historical pool can retain its previously unrecorded type.</p>}
    <p className="field-help">This is a draft choice. The Side Pool payout policy must still be disclosed before entries. Eligible paid entrants are ranked by their event scorecards.</p>
    <label>Pool name (optional)<input maxLength={160} value={sidePoolOptionalName(pool.poolTypeCode, index)} onChange={(event) => update({ ...pool, poolTypeCode: sidePoolNameFromInput(event.target.value, index) })} placeholder={`Side Pool ${index + 1}`} /></label>
    {feeInput}
    <label>Optional note<input maxLength={1000} value={pool.note} onChange={(event) => update({ ...pool, note: event.target.value })} /></label>
    <button type="button" className="secondary" onClick={remove}>Remove Side Pool</button>
  </fieldset>;
}
