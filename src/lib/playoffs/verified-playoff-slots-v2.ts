import {verifiedSeedSlots} from '../results/player-playoff-display.ts';
export type VerifiedPlayoffSlotV2={slot:number;bracketMatchId:string;roundNumber:number;round:'regular'|'semifinal'|'final';sides:[{seed:number|null;parentSlot:number|null},{seed:number|null;parentSlot:number|null}]};
/** Topological competitive matches only. Byes advance their actual seed without
 * creating a result/game; this reuses the literal verified ACC charts <=64. */
export function verifiedPlayoffSlotsV2(qualifiers:number):VerifiedPlayoffSlotV2[]|null{
 if(!Number.isSafeInteger(qualifiers)||qualifiers<4||qualifiers>64)return null;
 const size=[4,8,16,32,64].find(n=>n>=qualifiers)!,seeds=verifiedSeedSlots[size];
 let feeds:Array<{seed:number|null;parentSlot:number|null}>=seeds.map(seed=>({seed:seed<=qualifiers?seed:null,parentSlot:null}));
 const result:VerifiedPlayoffSlotV2[]=[],rounds=Math.log2(size);
 for(let round=1;feeds.length>1;round++){
  const next:typeof feeds=[];
  for(let i=0;i<feeds.length;i+=2){const a=feeds[i],b=feeds[i+1];
   if(a.seed===null&&a.parentSlot===null){next.push(b);continue;}
   if(b.seed===null&&b.parentSlot===null){next.push(a);continue;}
   const slot=result.length+1;result.push({slot,bracketMatchId:`r${round}-m${i/2+1}`,roundNumber:round,round:round===rounds?'final':round===rounds-1?'semifinal':'regular',sides:[{...a},{...b}]});next.push({seed:null,parentSlot:slot});
  }feeds=next;
 }
 return result.length===qualifiers-1?result:null;
}
