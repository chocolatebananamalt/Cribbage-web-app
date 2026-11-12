"use client";
import { useId } from 'react';
import { assessEventSeriesSettingsV1, resolveSeriesFormatDraftV1, type SeriesFormatDraftV1, type SeriesRuleContextV1 } from '../lib/playoffs/series-settings-v1';
import './playoff-series-settings-editor.css';
export type EventSeriesDraftV1 = { regular: SeriesFormatDraftV1; final: SeriesFormatDraftV1 };
type Props = { draft: EventSeriesDraftV1; onDraftChange: (draft: EventSeriesDraftV1) => void; context: SeriesRuleContextV1 | null; disabled?: boolean; sameFinal?: boolean; heading?: string | null };

/** Unwired controlled draft editor. It has no save or advancement authority.
 * A parent must resolve and version the complete settings transactionally. Raw
 * invalid Custom text remains explicit instead of silently saving an old preset. */
export function PlayoffSeriesSettingsEditor({ draft, onDraftChange, context, disabled = false, sameFinal = false, heading = 'Playoff Match Format' }: Props) {
  const id = useId(), regular = resolveSeriesFormatDraftV1(draft.regular), final = sameFinal ? regular : resolveSeriesFormatDraftV1(draft.final);
  const assessment = regular && final && context ? assessEventSeriesSettingsV1({ version: 'event-playoff-series-v1', regular, final }, context) : null;
  return <section className="playoff-series-editor" aria-labelledby={heading ? `${id}-heading` : undefined} aria-label={heading ? undefined : 'Playoff Match Series'}>
    {heading && <h3 id={`${id}-heading`}>{heading}</h3>}
    <p>{sameFinal ? 'Choose the match format for every round.' : 'Choose formats for Regular Rounds and the Final.'}</p>
    <div className="playoff-series-formats">{(sameFinal ? ['regular'] as const : ['regular', 'final'] as const).map(round => {
      const value = draft[round], format = round === 'regular' ? regular : final;
      const update = (next: SeriesFormatDraftV1) => onDraftChange({ ...draft, [round]: next });
      return <fieldset key={round} disabled={disabled}><legend>{round === 'regular' ? 'Regular Rounds' : 'Final'}</legend>
        <label htmlFor={`${id}-${round}-choice`}>Match Series</label>
        <select id={`${id}-${round}-choice`} value={value.choice} onChange={e => update({ ...value, choice: e.target.value as SeriesFormatDraftV1['choice'] })}>
          <option value="2-of-3">2 wins out of 3 games</option><option value="3-of-5">3 wins out of 5 games</option>
          <option value="4-of-7">4 wins out of 7 games</option><option value="custom">Custom wins out of total games</option>
        </select>
        {value.choice === 'custom' && <div className="playoff-series-custom">
          <label>Wins Required <span>(required)</span><input required maxLength={256} inputMode="numeric" pattern="[0-9]+" aria-describedby={`${id}-${round}-help`} aria-invalid={!format} value={value.winsText} onChange={e => update({ ...value, winsText: e.target.value })} /></label>
          <span aria-hidden="true">out of</span>
          <label>Total Games <span>(required)</span><input required maxLength={256} inputMode="numeric" pattern="[0-9]+" aria-describedby={`${id}-${round}-help`} aria-invalid={!format} value={value.gamesText} onChange={e => update({ ...value, gamesText: e.target.value })} /></label>
        </div>}
        <p id={`${id}-${round}-help`}>{format ? `First to ${format.winsRequired} ${format.winsRequired === 1 ? 'win' : 'wins'}. Stop once the match is won.` : 'Enter positive whole numbers. For a best-of series, total games must equal twice the required wins minus one.'}</p>
      </fieldset>;
    })}</div>
    <div aria-live="polite">{context === null && <p className="field-help">Rule context has not been verified; activation remains unavailable.</p>}{assessment?.status === 'invalid' && <p className="error-text">Review the event details before using these match formats.</p>}{assessment?.issues.map(issue => <p key={`${issue.round}-${issue.code}`} className={issue.severity === 'blocked' ? 'error-text' : 'field-help'}>
      <strong>{issue.round === 'regular' ? 'Regular rounds' : 'Final'}: </strong>{issue.message}
    </p>)}</div>
    <p className="field-help">Settle the match formats before playoff play begins.</p>
  </section>;
}
