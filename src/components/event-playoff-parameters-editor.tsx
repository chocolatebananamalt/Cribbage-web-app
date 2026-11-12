"use client";
import { useId } from 'react';
import { PlayoffSeriesSettingsEditor } from './playoff-series-settings-editor';
import { PlayoffPrizePlanV2 } from './playoff-prize-plan-v2';
import type {PlayoffPrizePlanDraftV2,PlayoffPrizeFieldV2} from '../lib/playoffs/playoff-prize-plan-v2';
import type { SeriesRuleContextV1 } from '../lib/playoffs/series-settings-v1';
import { validIncrementFactorDraftV1, type EventPlayoffParametersDraftV1 } from '../lib/playoffs/event-playoff-parameters-v1';
import './event-playoff-parameters-editor.css';

/** Local controlled editor; the host must version and persist its entire draft.
 * It intentionally has no network, storage, approval or payment authority. */
export function EventPlayoffParametersEditor({ draft, onDraftChange, context, disabled = false, setupSaveConnected = false, prizePlan }: {
  draft: EventPlayoffParametersDraftV1; onDraftChange: (next: EventPlayoffParametersDraftV1) => void;
  context: SeriesRuleContextV1 | null; disabled?: boolean; setupSaveConnected?: boolean;
  prizePlan?:{draft:PlayoffPrizePlanDraftV2;field:PlayoffPrizeFieldV2;onDraftChange:(next:PlayoffPrizePlanDraftV2,expected:PlayoffPrizePlanDraftV2)=>void};
}) {
  const id = useId(), update = (next: Partial<EventPlayoffParametersDraftV1>) => onDraftChange({ ...draft, ...next });
  return <section className="event-playoff-parameters" aria-labelledby={`${id}-heading`}>
    <h4 id={`${id}-heading`}>Playoff</h4>
    <p className="field-help">{setupSaveConnected ? "Included in the versioned Save All Events Draft request. Saving this draft does not authorize activation or calculate payouts." : "Local preview. These settings are not yet connected to Save All Events Draft."}</p>
    <label className="event-playoff-same"><input type="checkbox" disabled={disabled} checked={draft.finalMode === 'same'} onChange={e => update({ finalMode: e.target.checked ? 'same' : 'separate' })} />Use the Same Format for All Rounds</label>
    <PlayoffSeriesSettingsEditor heading={null} sameFinal={draft.finalMode === 'same'} draft={draft.series} onDraftChange={series => update({ series })} context={context} disabled={disabled} />
    <p className="field-help">Semifinals use the Regular Rounds format. A separate semifinal setting is not available in this preview.</p>
    {prizePlan ? <PlayoffPrizePlanV2 {...prizePlan} disabled={disabled} saveConnected={setupSaveConnected} /> : <><div className="event-playoff-payout">
      <label htmlFor={`${id}-payout`}>Payout Type<select id={`${id}-payout`} disabled={disabled} value={draft.payoutMode} onChange={e => update({ payoutMode: e.target.value as EventPlayoffParametersDraftV1['payoutMode'] })}>
        <option value="graduated">Graduated - Playoff Qualifiers</option>{draft.payoutMode === 'one-in' && <option value="one-in" disabled>Legacy 1-in-N - Review Required</option>}<option value="top">Top # (Custom)</option>
      </select></label>
      {draft.payoutMode !== 'graduated' && <label htmlFor={`${id}-count`}>{draft.payoutMode === 'one-in' ? 'Payout 1-in-' : 'Paid Places (Top)'} <span>(required)</span>
        <input id={`${id}-count`} disabled={disabled || draft.payoutMode === 'one-in'} maxLength={256} required inputMode="numeric" pattern="[0-9]+" value={draft.payoutMode === 'one-in' ? draft.oneInText : draft.topText} onChange={e => update(draft.payoutMode === 'one-in' ? { oneInText: e.target.value } : { topText: e.target.value })} aria-describedby={`${id}-paid-help`} />
      </label>}
      <label htmlFor={`${id}-factor`}>Increment Factor<input id={`${id}-factor`} disabled={disabled} required inputMode="decimal" value={draft.incrementFactorText} aria-invalid={!validIncrementFactorDraftV1(draft.incrementFactorText)} aria-describedby={`${id}-factor-help`} onChange={e => update({ incrementFactorText: e.target.value })} /></label>
    </div>
    {draft.payoutMode === 'one-in' && <p className="error-text" role="status">This saved 1-in-N regular-prize setting is retained for review. 1-in-N applies to Q-Pools and Side Pools, not Main or Consolation regular prizes. Choose a supported regular-prize setting; no saved value has been converted or deleted.</p>}
    <p id={`${id}-factor-help`} className="field-help">Default 1.5. Controls the increase between playoff finishing groups. The local comparison supports factors from 1 to 1,000, with up to six decimal places; this is a technical limit.</p>
    <p id={`${id}-paid-help`} className="field-help">Regular prizes are based on playoff qualifiers. Payout choices do not change playoff qualification. A cutoff includes the entire equal finishing group, with a warning if paid places increase. Calculation is not enabled in this prototype.</p></>}
  </section>;
}
