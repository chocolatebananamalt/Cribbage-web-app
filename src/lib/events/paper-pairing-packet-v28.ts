import {createHash} from 'node:crypto';
import {isUuid} from '../api/validation.ts';
import {isEventScheduleWorkspace,validateScheduleForEvent} from '../api/event-schedule.ts';
export type PairingRowV28={gameNumber:number;chair:string|null;opponentName:string|null;opponentId:string|null;opponentChair:string|null};
export type PairingCardV28={name:string;fixedId:string;rows:PairingRowV28[]};
export type PairingPacketV28={tournamentName:string;eventName:string;reference:string;cards:PairingCardV28[]};
const safeText=(s:string,max=200)=>!!s.trim()&&s.length<=max&&!/[\u0000-\u001f\u007f]|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|temporary\s*id\s*#\s*[0-9]+/i.test(s.normalize('NFKC'));
export function buildPaperPairingPacketV28(value:unknown,eventId:string,player?:string):PairingPacketV28|null {
 if(!isUuid(eventId)||player!==undefined&&!/^[A-Z]-[1-9][0-9]*$/.test(player)||!isEventScheduleWorkspace(value)||!safeText(value.tournamentName)||value.tableCount===null||value.seatsPerTable===null)return null;
 const event=value.events.filter(e=>e.eventId===eventId);if(event.length!==1)return null;const e=event[0];
 if(e.format!=='standard_singles'||e.scoringMethod!=='digital'||!e.schedulePublished||!e.schedulePublicationId||!e.participantSnapshotDigest||!safeText(e.name)||e.participantCount<2||e.participantCount>500)return null;
 const people=value.participants.filter(p=>p.eventId===eventId),matches=value.matches.filter(m=>m.eventId===eventId);
 if(people.length!==e.participantCount||matches.length!==e.publishedMatchCount||new Set(people.map(p=>p.participantId.toLowerCase())).size!==people.length||new Set(people.map(p=>p.verificationId)).size!==people.length||new Set(matches.map(m=>m.canonicalGameId.toLowerCase())).size!==matches.length||people.some(p=>!safeText(p.displayName)))return null;
 if(validateScheduleForEvent(matches,e.gameCount,people.map(p=>p.verificationId),value.tableCount,value.seatsPerTable).length)return null;
 const byId=new Map(people.map(p=>[p.verificationId,p]));
 if(matches.some(m=>byId.get(m.sideAVerificationId)?.displayName!==m.sideADisplayName||byId.get(m.sideBVerificationId)?.displayName!==m.sideBDisplayName))return null;
 if(player!==undefined&&!byId.has(player))return null;
 const cards=people.map(p=>({name:p.displayName,fixedId:p.verificationId,rows:Array.from({length:e.gameCount},(_,n)=>{const gameNumber=n+1,m=matches.find(m=>m.gameNumber===gameNumber&&(m.sideAVerificationId===p.verificationId||m.sideBVerificationId===p.verificationId));if(!m)return{gameNumber,chair:null,opponentName:null,opponentId:null,opponentChair:null};const a=m.sideAVerificationId===p.verificationId;return{gameNumber,chair:a?m.sideATableSeat:m.sideBTableSeat,opponentName:a?m.sideBDisplayName:m.sideADisplayName,opponentId:a?m.sideBVerificationId:m.sideAVerificationId,opponentChair:a?m.sideBTableSeat:m.sideATableSeat};})})).sort((a,b)=>a.fixedId.localeCompare(b.fixedId,'en',{numeric:true}));
 const reference=createHash('sha256').update(JSON.stringify([e.schedulePublicationId,e.participantSnapshotDigest,value.tableCount,value.seatsPerTable,cards])).digest('hex').slice(0,16);
 return{tournamentName:value.tournamentName,eventName:e.name,reference,cards:player?cards.filter(c=>c.fixedId===player):cards};
}
