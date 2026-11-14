import type {SatellitePlacement} from '../api/satellite-results.ts';
/** Recorded result amounts only. Not a funds/receipt/obligation/payment reader. */
export function summarizeSatelliteAwardBuckets(rows:readonly SatellitePlacement[]){
 let regular=BigInt(0),q=BigInt(0),side=BigInt(0);const maximum=BigInt(Number.MAX_SAFE_INTEGER);
 for(const row of rows){if(![row.prizeMinor,row.qPoolMinor,row.sidePoolMinor].every(v=>Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0)))return null;regular+=BigInt(row.prizeMinor);q+=BigInt(row.qPoolMinor);side+=BigInt(row.sidePoolMinor);}
 if(regular+q+side>maximum)return null;
 return{regularPrizeMinor:Number(regular),qPoolMinor:Number(q),sidePoolMinor:Number(side),combinedMinor:Number(regular+q+side),fundingVerified:false as const,paymentVerified:false as const};
}