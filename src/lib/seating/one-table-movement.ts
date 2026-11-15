/** Display verification only; never generates, repairs or publishes seating. */
export const oneTableMovementVersion = 'one-table-18-anchor-seat-1-display-v1' as const;
export const oneTableMovementSourceUrl = 'https://www.cribbage.org/grassroots/docs/General_GR_Docs/Manual/GR_Manual_Ver_8.1_FINAL_08102026.pdf';
export type OneTableMovementConfig = {tables:readonly {tableId:string;seatCount:number}[];activePairIds:readonly string[]};
export type OneTableMovementCandidate = {anchor:{seatId:string;participantId:string};assignments:readonly {participantId:string;tournamentId:string}[];matches:readonly {round:number;pairId:string;sides:readonly {participantId:string;seatId:string}[]}[]};
export type OneTableMove = {fromSeat:string;toSeat:string;kind:'stay'|'anchor-bypass'|'far-end'|'advance'};
export type OneTablePlayer = {participantId:string;tournamentId:string;currentSeat:string;opponentId:string;opponentTournamentId:string;movement:OneTableMove|null};
export type OneTableMovementResult = {status:'verified';version:typeof oneTableMovementVersion;tableId:string;anchor:{seatId:string;participantId:string};rounds:{round:number;players:OneTablePlayer[]}[];sourceUrl:string;physicalRoomVerified:false;publishable:false}
 | {status:'blocked';code:'unsupported_geometry'|'unsupported_anchor'|'invalid_assignments'|'invalid_rounds'|'invalid_facing_pair'|'repeated_opponent'|'first_id_mismatch'|'movement_mismatch'};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const identifier=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
/** Independently transcribed single-table movement: odd side forward, even side
 * backward, with the two end exceptions and the stationary seat-one anchor. */
export function nextOneTableSeat(seat:number):number {
  if(!Number.isInteger(seat)||seat<1||seat>18)throw new Error('Unsupported physical seat');
  if(seat===1)return 1;
  if(seat===2)return 3;
  if(seat===17)return 18;
  return seat%2===1?seat+2:seat-2;
}
export function projectOneTableMovement(config:unknown,candidate:unknown):OneTableMovementResult {
  const blocked=(code:Extract<OneTableMovementResult,{status:'blocked'}>['code']):OneTableMovementResult=>({status:'blocked',code});
  if(!object(config)||!Array.isArray(config.tables)||config.tables.length!==1||!object(config.tables[0])||typeof config.tables[0].tableId!=='string'||!/^[A-Z]$/.test(config.tables[0].tableId)||config.tables[0].seatCount!==18||!Array.isArray(config.activePairIds)||config.activePairIds.length!==9)return blocked('unsupported_geometry');
  const tableId=config.tables[0].tableId,seat=(n:number)=>`${tableId}-${n}`;
  const expectedPairs=new Set(Array.from({length:9},(_,i)=>`${tableId}:${i*2+1}-${i*2+2}`));
  if(new Set(config.activePairIds).size!==9||config.activePairIds.some(p=>typeof p!=='string'||!expectedPairs.has(p)))return blocked('unsupported_geometry');
  if(!object(candidate)||!object(candidate.anchor)||candidate.anchor.seatId!==seat(1)||!identifier(candidate.anchor.participantId))return blocked('unsupported_anchor');
  const anchorId=candidate.anchor.participantId;
  if(!Array.isArray(candidate.assignments)||candidate.assignments.length!==18)return blocked('invalid_assignments');
  const fixedIds=new Map<string,string>(),initialSeats=new Set<string>(),seats=new Set(Array.from({length:18},(_,i)=>seat(i+1)));
  for(const a of candidate.assignments){
    if(!object(a)||!identifier(a.participantId)||typeof a.tournamentId!=='string'||!seats.has(a.tournamentId)||fixedIds.has(a.participantId)||initialSeats.has(a.tournamentId))return blocked('invalid_assignments');
    fixedIds.set(a.participantId,a.tournamentId);initialSeats.add(a.tournamentId);
  }
  if(fixedIds.get(anchorId)!==seat(1))return blocked('unsupported_anchor');
  if(!Array.isArray(candidate.matches)||candidate.matches.length!==108)return blocked('invalid_rounds');
  const positions=new Map<number,Map<string,{seatId:string;opponentId:string}>>(),usedSeats=new Map<number,Set<string>>(),usedPairs=new Map<number,Set<string>>(),opponents=new Map([...fixedIds.keys()].map(p=>[p,new Set<string>()]));
  for(const m of candidate.matches){
    if(!object(m)||!Number.isInteger(m.round)||Number(m.round)<1||Number(m.round)>12||typeof m.pairId!=='string'||!expectedPairs.has(m.pairId)||!Array.isArray(m.sides)||m.sides.length!==2)return blocked('invalid_rounds');
    const round=m.round as number,roundPositions=positions.get(round)??new Map<string,{seatId:string;opponentId:string}>(),roundSeats=usedSeats.get(round)??new Set<string>(),roundPairs=usedPairs.get(round)??new Set<string>();
    if(roundPairs.has(m.pairId))return blocked('invalid_facing_pair');
    const pairNumbers=m.pairId.split(':')[1].split('-').map(Number),facing=new Set(pairNumbers.map(seat));
    const [a,b]=m.sides;
    for(const side of [a,b])if(!object(side)||!identifier(side.participantId)||!fixedIds.has(side.participantId)||typeof side.seatId!=='string'||!facing.has(side.seatId)||roundPositions.has(side.participantId)||roundSeats.has(side.seatId))return blocked('invalid_facing_pair');
    if(a.participantId===b.participantId||a.seatId===b.seatId)return blocked('invalid_facing_pair');
    if(opponents.get(a.participantId)!.has(b.participantId))return blocked('repeated_opponent');
    opponents.get(a.participantId)!.add(b.participantId);opponents.get(b.participantId)!.add(a.participantId);
    for(const [side,other]of [[a,b],[b,a]]){roundPositions.set(side.participantId,{seatId:side.seatId,opponentId:other.participantId});roundSeats.add(side.seatId);if(round===1&&fixedIds.get(side.participantId)!==side.seatId)return blocked('first_id_mismatch');}
    roundPairs.add(m.pairId);positions.set(round,roundPositions);usedSeats.set(round,roundSeats);usedPairs.set(round,roundPairs);
  }
  if(positions.size!==12||[...positions.values()].some(p=>p.size!==18)||[...opponents.values()].some(p=>p.size!==12))return blocked('invalid_rounds');
  const rounds:{round:number;players:OneTablePlayer[]}[]=[];
  for(let round=1;round<=12;round++){
    const current=positions.get(round)!,next=positions.get(round+1),players:OneTablePlayer[]=[];
    if(current.get(anchorId)?.seatId!==seat(1))return blocked('movement_mismatch');
    for(const [participantId,fixedId]of fixedIds){
      const p=current.get(participantId)!,n=Number(p.seatId.split('-')[1]),toSeat=seat(nextOneTableSeat(n));
      if(next&&next.get(participantId)?.seatId!==toSeat)return blocked('movement_mismatch');
      players.push({participantId,tournamentId:fixedId,currentSeat:p.seatId,opponentId:p.opponentId,opponentTournamentId:fixedIds.get(p.opponentId)!,movement:next?{fromSeat:p.seatId,toSeat,kind:n===1?'stay':n===2?'anchor-bypass':n===17?'far-end':'advance'}:null});
    }
    players.sort((a,b)=>Number(a.currentSeat.split('-')[1])-Number(b.currentSeat.split('-')[1]));rounds.push({round,players});
  }
  return {status:'verified',version:oneTableMovementVersion,tableId,anchor:{seatId:seat(1),participantId:anchorId},rounds,sourceUrl:oneTableMovementSourceUrl,physicalRoomVerified:false,publishable:false};
}
