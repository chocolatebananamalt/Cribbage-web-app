"use client";
import "./setup-side-pool-editor.css";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { isGraduatedSidePoolSetupType, sidePoolPayoutTypeFromRatioDraft, sidePoolRatioDraftMessage, sidePoolNameFromInput, sidePoolOptionalName, type SidePoolSetupSelection } from '../lib/api/side-pool-setup-selection';

type Props = {
  pool: SidePoolSetupSelection;
  index: number;
  update: (value: SidePoolSetupSelection) => void;
  remove: () => void;
  /** Existing validated $5-increment money input is supplied by the setup form. */
  feeInput: ReactNode;
  supportedFormat: boolean;
  onValidityChange?: (valid: boolean) => void;
  /** Stable local identity only; never included in the saved setup. */
  editorIdentity?: string;
};

export function SetupSidePoolEditor(props: Props) {
  // Stable local identity prevents removed rows lending a custom ratio to the
  // next pool. Editing a name must never remount its focused input.
  return <SidePoolEditorState key={props.editorIdentity ?? "single-side-editor"} {...props} />;
}
function SidePoolEditorState({ pool, index, update, remove, feeInput, supportedFormat, onValidityChange }: Props) {
  const [ratioDraft, setRatioDraft] = useState(''), [customChosen, setCustomChosen] = useState(false);
  const callback = useRef(onValidityChange), helpId = useId(), typeId = useId();
  useLayoutEffect(() => { callback.current = onValidityChange; }, [onValidityChange]);
  const ratioIssue = customChosen ? sidePoolRatioDraftMessage(ratioDraft) : null;
  useEffect(() => {
    const notify = callback.current; notify?.(!ratioIssue);
    return () => { notify?.(true); };
  }, [ratioIssue, index]);
  return <fieldset className="setup-subsection setup-side-pool-editor"><legend>Side Pool {index + 1}</legend>
    <div className="setup-side-payout-heading"><label htmlFor={typeId}>Payout</label>
      {customChosen && <label className="setup-side-ratio-line"><span>1-in-</span><input disabled={!supportedFormat} required aria-required="true" aria-label="Side Pool Payout Ratio" aria-invalid={!!ratioIssue} aria-describedby={helpId} inputMode="numeric" pattern="[0-9]+" value={ratioDraft} onChange={event => {
        const value = event.target.value; setRatioDraft(value); callback.current?.(!sidePoolRatioDraftMessage(value)); update({ ...pool, payoutType: sidePoolPayoutTypeFromRatioDraft(value) ?? undefined });
      }} /><span aria-hidden="true" className="setup-side-ratio-required">*</span><span className="sr-only"> (required)</span></label>}
    </div>
    <select id={typeId} aria-label="Payout Type" required disabled={!supportedFormat} value={customChosen ? 'custom' : pool.payoutType ?? ''} onChange={(event) => {
      const value = event.target.value;
      if (value === 'custom') { setCustomChosen(true); setRatioDraft(''); callback.current?.(false); update({ ...pool, payoutType: undefined }); return; }
      setCustomChosen(false); setRatioDraft(''); callback.current?.(true);
      update({ ...pool, payoutType: isGraduatedSidePoolSetupType(value) ? value : undefined });
    }}>
      <option value="">Select a Side Pool type</option>
      <option value="graduated-1-in-4">Graduated (1-in-4)</option>
      <option value="graduated-1-in-6">Graduated (1-in-6)</option>
      <option value="graduated-1-in-8">Graduated (1-in-8)</option>
      <option value="graduated-1-in-10">Graduated (1-in-10)</option>
      <option value="custom">Graduated 1-in-# (Custom)</option>
    </select>
    {customChosen && <p id={helpId} className={ratioIssue ? 'error-text' : 'field-help'}>{ratioIssue ?? `Payout ratio: 1-in-${Number(ratioDraft)}, under the separately disclosed policy.`}</p>}
    {!supportedFormat && <p className="field-help">Graduated Side Pool payouts currently require Standard Singles scoring. Remove this pool or choose a supported event format before saving.</p>}
    {!pool.payoutType && <p className="field-help">New Side Pools need a payout type. An unchanged historical pool can retain its previously unrecorded type.</p>}
    <p className="field-help">This is a draft choice. The Side Pool payout policy must still be disclosed before entries. Eligible paid entrants are ranked by their event scorecards.</p>
    <label>Pool Name (Optional)<input maxLength={160} value={sidePoolOptionalName(pool.poolTypeCode, index)} onChange={(event) => update({ ...pool, poolTypeCode: sidePoolNameFromInput(event.target.value, index) })} placeholder={`Side Pool ${index + 1}`} /></label>
    {feeInput}
    <label>Optional Note<input maxLength={1000} value={pool.note} onChange={(event) => update({ ...pool, note: event.target.value })} /></label>
    <button type="button" className="secondary" onClick={remove}>Remove Side Pool</button>
  </fieldset>;
}
