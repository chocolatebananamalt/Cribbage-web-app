import { resolveMainConPaidPlaceCutoffV1 } from './maincon-paid-place-cutoff-v1.ts';
import type { MainConSourceSettingsV1 } from './maincon-source-model-v1.ts';
export type MainConFundInputV2 = { fundMinor: number; qualifierCount: number; settings: MainConSourceSettingsV1 };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => obj(v) && Reflect.ownKeys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && !Object.is(v, -0);
const gcd = (x: bigint, y: bigint): bigint => { while (y) { const r = x % y; x = y; y = r; } return x; };
const usd = (n: bigint) => { const magnitude=n<BigInt(0)?-n:n; return `${n<BigInt(0)?'-':''}$${String(magnitude/BigInt(100)).replace(/\B(?=(\d{3})+(?!\d))/g,',')}.${String(magnitude%BigInt(100)).padStart(2,'0')}`; };
/** New explicit-fund comparison method. Never substitutes a fake entrant count
 * or uniform fee for actual ledger gross. Original V1 methods are untouched.
 * Owner approved whole-band expansion; ratio population/rounding is unresolved.
 * Source-sheet nearest-$5 rounding stays visible even when it over/underspends.
 */
export function calculateMainConFundComparisonV2(value: unknown) {
  const fail = (code: string) => ({ status: 'blocked' as const, code });
  if (!exact(value, ['fundMinor', 'qualifierCount', 'settings']) || !whole(value.fundMinor) || !whole(value.qualifierCount) || value.qualifierCount < 1 || value.qualifierCount > 10000 || !obj(value.settings)) return fail('invalid_input');
  const fundMinor=value.fundMinor;
  const settings = value.settings;
  if (typeof settings.factor !== 'string' || settings.factor.length > 16 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(settings.factor)) return fail('invalid_factor');
  const [wholePart, decimal = ''] = settings.factor.split('.'), den = BigInt(10) ** BigInt(decimal.length), num = BigInt(wholePart) * den + BigInt(decimal || '0');
  if (num < den || num > BigInt(1000) * den) return fail('factor_outside_technical_domain');
  let requested: number;
  if (exact(settings, ['method', 'factor']) && settings.method === 'graduated_all_qualifiers') requested = value.qualifierCount;
  else if (exact(settings, ['method', 'paidPlaces', 'factor']) && settings.method === 'custom_top_paid' && whole(settings.paidPlaces) && settings.paidPlaces > 0) requested = settings.paidPlaces;
  else if (exact(settings, ['method', 'ratio', 'factor']) && settings.method === 'custom_paid_ratio' && whole(settings.ratio) && settings.ratio > 0) return fail('custom_ratio_paid_count_policy_unresolved');
  else return fail('invalid_settings');
  const cutoff = resolveMainConPaidPlaceCutoffV1({ requestedPaidPlaces: requested, qualifierCount: value.qualifierCount });
  if (cutoff.status !== 'resolved') return fail(cutoff.code);
  if (BigInt(value.fundMinor) > BigInt(Number.MAX_SAFE_INTEGER) - BigInt(500) * BigInt(cutoff.actualPaidPlaces)) return fail('technical_resource_bound');
  const bands: Array<{firstPlace:number;lastPlace:number;people:number}> = [];
  for (let first=1; first<=cutoff.actualPaidPlaces; first=first===1?2:first*2-1) {
    const last=Math.min(cutoff.actualPaidPlaces,first===1?1:(first-1)*2); bands.push({firstPlace:first,lastPlace:last,people:last-first+1});
  }
  const weights=bands.map((_,i)=>num**BigInt(bands.length-1-i)*den**BigInt(i));
  const denominator=weights.reduce((sum,w,i)=>sum+w*BigInt(bands[i].people),BigInt(0));let total=BigInt(0);
  const awards=bands.map((band,i)=>{const raw=BigInt(fundMinor)*weights[i],rounded=((raw*BigInt(2)+denominator*BigInt(500))/(denominator*BigInt(1000)))*BigInt(500),bandTotal=rounded*BigInt(band.people),divisor=gcd(raw,denominator);total+=bandTotal;return{...band,perPersonMinor:Number(rounded),bandTotalMinor:Number(bandTotal),unroundedPerPerson:{numeratorMinor:String(raw/divisor),denominator:String(denominator/divisor)}};});
  const difference=total-BigInt(fundMinor);
  const balanceWarning=difference===BigInt(0)?null:`Calculated payouts total ${usd(total)} against a fund of ${usd(BigInt(fundMinor))}: ${usd(difference<BigInt(0)?-difference:difference)} ${difference<BigInt(0)?'under':'over'}.`;
  return {status:'calculated_comparison' as const,version:'maincon-explicit-fund-whole-bands-v2' as const,fundMinor:value.fundMinor,qualifierCount:value.qualifierCount,factor:settings.factor,
    requestedPaidPlaces:cutoff.requestedPaidPlaces,actualPaidPlaces:cutoff.actualPaidPlaces,cutoffWarning:cutoff.warning,balanceWarning,bands:awards,
    roundedAwardsTotalMinor:Number(total),discrepancyMinor:Number(total-BigInt(value.fundMinor)),balanced:balanceWarning===null,zeroAwardBand:awards.some(b=>b.perPersonMinor===0),
    rounding:'nearest-5usd-positive-halves-up' as const,qualificationChanged:false as const,authoritative:false as const,finalizationAllowed:false as const,moneyMoved:false as const};
}
