import {isUuid} from '../api/validation.ts';
export type ManualMixedOfficialStatusV1={gameId:string;eventId:string;decision:'yes'|'no'};
export function readManualMixedOfficialStatusV1(v:unknown,visible:readonly {gameId:string;eventId?:string}[]):ManualMixedOfficialStatusV1[]|null{
 if(!Array.isArray(v))return null;const seen=new Set<string>();const result:ManualMixedOfficialStatusV1[]=[];
 for(const x of v){if(!x||typeof x!=='object'||Object.keys(x).length!==3||!isUuid(x.gameId)||!isUuid(x.eventId)||!['yes','no'].includes(x.decision)||seen.has(x.gameId)||!visible.some(g=>g.gameId===x.gameId&&(!g.eventId||g.eventId===x.eventId)))return null;seen.add(x.gameId);result.push(x);}return result;
}
