/** Metadata only. A directory link is never permission to capture or review. */
export type PaperDirectoryScopeV1={actorId:string;sessionId:string;tournamentId:string;eventId:string;startId:string};
type Person={displayName:string;fixedTournamentId:string;currentSeat:string;mode:'paper'|'digital'};
export type PaperDirectoryV1=PaperDirectoryScopeV1&{kind:'native-mixed-paper-directory-v1';startSourceDigest:string;tournamentName:string;eventName:string;simulationOnly:true;games:{gameId:string;gameNumber:number;sideA:Person;sideB:Person}[]};
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const text=(v:unknown,max=160):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/u.test(v);
const person=(v:unknown):v is Person=>exact(v,['displayName','fixedTournamentId','currentSeat','mode'])&&text(v.displayName)&&text(v.fixedTournamentId,32)&&typeof v.currentSeat==='string'&&/^[A-Z]{1,3}-[1-9]\d{0,2}$/.test(v.currentSeat)&&['paper','digital'].includes(String(v.mode));
export function readPaperDirectoryV1(value:unknown,scope:PaperDirectoryScopeV1):PaperDirectoryV1|null{
 if(!exact(scope,['actorId','sessionId','tournamentId','eventId','startId'])||!Object.values(scope).every(uuid)||!exact(value,['kind',...Object.keys(scope),'startSourceDigest','tournamentName','eventName','simulationOnly','games'])||value.kind!=='native-mixed-paper-directory-v1'||value.simulationOnly!==true||Object.entries(scope).some(([k,v])=>value[k]!==v)||typeof value.startSourceDigest!=='string'||!/^[a-f0-9]{64}$/.test(value.startSourceDigest)||!text(value.tournamentName)||!text(value.eventName)||!Array.isArray(value.games)||value.games.length>108)return null;
 const ids=new Set<string>(),places=new Set<string>();
 for(const g of value.games){
  if(!exact(g,['gameId','gameNumber','sideA','sideB'])||!uuid(g.gameId)||ids.has(g.gameId)||typeof g.gameNumber!=='number'||!Number.isInteger(g.gameNumber)||g.gameNumber<1||g.gameNumber>12||!person(g.sideA)||!person(g.sideB)||g.sideA.fixedTournamentId===g.sideB.fixedTournamentId||g.sideA.currentSeat===g.sideB.currentSeat||!(g.sideA.mode==='paper'||g.sideB.mode==='paper'))return null;
  ids.add(g.gameId);
  for(const p of[g.sideA,g.sideB]){for(const key of[`${g.gameNumber}:id:${p.fixedTournamentId}`,`${g.gameNumber}:seat:${p.currentSeat}`]){if(places.has(key))return null;places.add(key);}}
 }
 return structuredClone(value)as PaperDirectoryV1;
}
export function paperDirectoryGameHrefV1(directory:PaperDirectoryV1,gameId:string):string|null{
 const valid=readPaperDirectoryV1(directory,{actorId:directory.actorId,sessionId:directory.sessionId,tournamentId:directory.tournamentId,eventId:directory.eventId,startId:directory.startId});
 return valid?.games.some(g=>g.gameId===gameId)?`/tournament/${valid.tournamentId}/rehearsal-paper/${valid.eventId}/${valid.startId}/${gameId}`:null;
}
