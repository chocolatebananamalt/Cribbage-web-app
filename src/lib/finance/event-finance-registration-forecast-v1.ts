import {calculateMainConFundComparisonV2} from '../results/maincon-fund-comparison-v2.ts';
import type {MainConSourceSettingsV1} from '../results/maincon-source-model-v1.ts';

export type EventFinanceRegistrationForecastInputV1={
 policy:'regular-top-quarter-round-up';eventKind:'main'|'consolation';eventStyle:'Standard';eventFormat:'standard_singles';
 officialQualifierCount:null;entryCount:number;fundMinor:number;settings:MainConSourceSettingsV1;
};

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>object(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const whole=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&!Object.is(value,-0);
const authority={sourceClaim:'forecast' as const,officialQualifierCount:null,qualificationChanged:false as const,authoritative:false as const,finalizationAllowed:false as const,payoutAuthorized:false as const,moneyMoved:false as const,writeAuthorized:false as const};

/** Registration-stage estimate only. Entry count includes comped
 * registrations; no paid-count input is accepted and no official result is
 * changed. The caller must supply the reviewed regular-event policy facts. */
export function calculateEventFinanceRegistrationForecastV1(value:unknown){
 const fail=(code:string)=>({status:'blocked' as const,code,...authority});
 if(!exact(value,['policy','eventKind','eventStyle','eventFormat','officialQualifierCount','entryCount','fundMinor','settings']))return fail('invalid_input');
 if(value.policy!=='regular-top-quarter-round-up')return fail('unsupported_forecast_policy');
 if(!['main','consolation'].includes(value.eventKind as string)||value.eventStyle!=='Standard'||value.eventFormat!=='standard_singles'||value.officialQualifierCount!==null)return fail('unsupported_forecast_source');
 if(!whole(value.entryCount)||value.entryCount<1||!whole(value.fundMinor))return fail('invalid_input');
 const estimatedQualifierCount=Math.ceil(value.entryCount/4);
 const comparison=calculateMainConFundComparisonV2({fundMinor:value.fundMinor,qualifierCount:estimatedQualifierCount,settings:value.settings});
 if(comparison.status==='blocked')return fail(comparison.code);
 return{status:'forecast' as const,kind:'event-finance-registration-forecast-v1' as const,version:1 as const,policy:value.policy,
  eventKind:value.eventKind,eventStyle:value.eventStyle,eventFormat:value.eventFormat,entryPopulation:'registration_entries_including_comped' as const,
  entryCount:value.entryCount,estimatedQualifierCount,fundMinor:value.fundMinor,forecastOnly:true as const,comparison,...authority};
}
