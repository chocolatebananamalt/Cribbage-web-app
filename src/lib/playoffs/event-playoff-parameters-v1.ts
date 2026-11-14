import { resolveSeriesFormatDraftV1, type SeriesFormatDraftV1, type EventSeriesSettingsV1 } from './series-settings-v1.ts';
import { parseCustomPayoutRatioDraftV1 } from '../api/custom-payout-intent-v1.ts';
import type { MainConSourceSettingsV1 } from '../results/maincon-source-model-v1.ts';
export type EventPlayoffParametersDraftV1 = {
  version: 'event-playoff-parameters-draft-v1'; finalMode: 'same' | 'separate';
  series: { regular: SeriesFormatDraftV1; final: SeriesFormatDraftV1 };
  payoutMode: 'graduated' | 'one-in' | 'top'; oneInText: string; topText: string; incrementFactorText: string;
};
export function newEventPlayoffParametersDraftV1(eventKind: 'main' | 'consolation'): EventPlayoffParametersDraftV1 {
  const choice = eventKind === 'main' ? '3-of-5' : '2-of-3';
  return { version: 'event-playoff-parameters-draft-v1', finalMode: 'same', series: {
    regular: { choice, winsText: '', gamesText: '' }, final: { choice, winsText: '', gamesText: '' } },
    payoutMode: 'graduated', oneInText: '', topText: '', incrementFactorText: '1.5' };
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
/** Raw draft shape permits incomplete Custom fields; it grants no activation. */
export function isEventPlayoffParametersDraftV1(v: unknown): v is EventPlayoffParametersDraftV1 {
  if (!object(v) || !exact(v, ['version', 'finalMode', 'series', 'payoutMode', 'oneInText', 'topText', 'incrementFactorText'])
    || v.version !== 'event-playoff-parameters-draft-v1' || !['same', 'separate'].includes(v.finalMode as string)
    || !['graduated', 'one-in', 'top'].includes(v.payoutMode as string)
    || !object(v.series) || !exact(v.series, ['regular', 'final'])) return false;
  for (const round of [v.series.regular, v.series.final]) {
    if (!object(round) || !exact(round, ['choice', 'winsText', 'gamesText'])
      || !['2-of-3', '3-of-5', '4-of-7', 'custom'].includes(round.choice as string)
      || typeof round.winsText !== 'string' || round.winsText.length > 256
      || typeof round.gamesText !== 'string' || round.gamesText.length > 256) return false;
  }
  return ['oneInText', 'topText', 'incrementFactorText'].every(k => typeof v[k] === 'string' && (v[k] as string).length <= 256);
}
export function validIncrementFactorDraftV1(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 16 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(raw)) return false;
  const [whole, decimal = ''] = raw.split('.'), den = BigInt(10) ** BigInt(decimal.length), num = BigInt(whole) * den + BigInt(decimal || '0');
  return num >= den && num <= BigInt(1000) * den;
}
/** Resolve sporting settings without interpreting dormant legacy payout fields.
 * Used only by a separately pinned V2 prize-policy branch. */
export function resolveEventSeriesDraftV1(v: unknown): EventSeriesSettingsV1 | null {
  if (!isEventPlayoffParametersDraftV1(v)) return null;
  const regular = resolveSeriesFormatDraftV1(v.series.regular);
  const final = v.finalMode === 'same' ? regular : resolveSeriesFormatDraftV1(v.series.final);
  return regular && final ? { version: 'event-playoff-series-v1', regular, final } : null;
}
/** Structural draft resolution only. No qualification, paid-place count,
 * official approval, persistence or payout calculation is inferred. */
export function resolveEventPlayoffParametersDraftV1(v: unknown): null | {
  series: EventSeriesSettingsV1; finalMode: 'same' | 'separate'; payout: MainConSourceSettingsV1;
  persistenceAvailable: false; calculatedPayoutsAvailable: false;
} {
  if (!isEventPlayoffParametersDraftV1(v) || !object(v) || !exact(v, ['version', 'finalMode', 'series', 'payoutMode', 'oneInText', 'topText', 'incrementFactorText'])
    || v.version !== 'event-playoff-parameters-draft-v1' || (v.finalMode !== 'same' && v.finalMode !== 'separate')
    || !object(v.series) || !exact(v.series, ['regular', 'final']) || typeof v.oneInText !== 'string' || typeof v.topText !== 'string'
    || !validIncrementFactorDraftV1(v.incrementFactorText)) return null;
  const retainedFinal = v.series.final;
  if (!object(retainedFinal) || !exact(retainedFinal, ['choice', 'winsText', 'gamesText'])
    || !['2-of-3', '3-of-5', '4-of-7', 'custom'].includes(retainedFinal.choice as string)
    || typeof retainedFinal.winsText !== 'string' || typeof retainedFinal.gamesText !== 'string') return null;
  const regular = resolveSeriesFormatDraftV1(v.series.regular);
  if (!regular) return null;
  const final = v.finalMode === 'same' ? regular : resolveSeriesFormatDraftV1(retainedFinal);
  if (!final) return null;
  let payout: MainConSourceSettingsV1;
  if (v.payoutMode === 'graduated') payout = { method: 'graduated_all_qualifiers', factor: v.incrementFactorText };
  else if (v.payoutMode === 'one-in' || v.payoutMode === 'top') {
    const count = parseCustomPayoutRatioDraftV1(v.payoutMode === 'one-in' ? v.oneInText : v.topText);
    if (!count || count > 2_147_483_647) return null;
    payout = v.payoutMode === 'one-in' ? { method: 'custom_paid_ratio', ratio: count, factor: v.incrementFactorText }
      : { method: 'custom_top_paid', paidPlaces: count, factor: v.incrementFactorText };
  } else return null;
  return { series: { version: 'event-playoff-series-v1', regular, final }, finalMode: v.finalMode, payout,
    persistenceAvailable: false, calculatedPayoutsAvailable: false };
}
