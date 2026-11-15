import {readPracticeQualificationFinanceReviewV1} from '../finance/native-mixed-qualification-review-v1.ts';
import {resolveEventSeriesDraftV1} from './event-playoff-parameters-v1.ts';
import {playoffSeriesProgressV1} from './series-progress-v1.ts';
import {deriveFiveQualifierPlayoff} from '../results/five-qualifier-playoff.ts';

type Row=Record<string,unknown>;
type Player={participantId:string;profileId:string|null;mode:'digital'|'paper';fixedTournamentId:string};
type Official={actorId:string;participantId:string|null;role:'paper-preparer'|'paper-reviewer'};
const flags={simulationOnly:true as const,ordinaryQualificationRecorded:false as const,mrpAwarded:false as const,writeAuthorized:false as const,advancingAuthority:false as const,payoutAuthorized:false as const,moneyMoved:false as const};
const fail=(code:string)=>({status:'blocked' as const,code,...flags});
const obj=(v:unknown):v is Row=>!!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Row=>obj(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d&&'value'in d&&d.enumerable;});
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
function safe(v:unknown,seen=new Set<object>(),depth=0,budget={n:0}):boolean{if(depth>24||++budget.n>250000)return false;if(v===null||typeof v==='string'||typeof v==='boolean')return true;if(typeof v==='number')return Number.isSafeInteger(v)&&!Object.is(v,-0);if(typeof v!=='object'||(!obj(v)&&!Array.isArray(v))||seen.has(v))return false;const keys=Reflect.ownKeys(v);if(keys.length>10001)return false;if(Array.isArray(v)&&!dense(v,10000))return false;seen.add(v);for(const k of keys){if(Array.isArray(v)&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||!d||!('value'in d)||!d.enumerable||!safe(d.value,seen,depth+1,budget))return false;}seen.delete(v);return true;}
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>obj(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);

/** Source contract only. The future authenticated writer must reread/lock actual
 * Start, funding, settings and review. Posted objects/hashes grant no authority. */
export function prepareNativeMixedPlayoffV1(input:unknown){
 try{
  if(!safe(input)||!exact(input,['review','start','settings','roster','officials']))return fail('invalid_context');
  const review=readPracticeQualificationFinanceReviewV1(input.review),s=input.start,b=input.settings;
  if(!review||!review.qualificationReady||review.tieReviewRequired)return fail('untied_current_mixed_review_required');
  if(!exact(s,['tournamentId','eventId','startId','startSourceDigest','fundingSourceDigest'])||s.tournamentId!==review.tournamentId||s.eventId!==review.eventId||s.startId!==review.startId||s.startSourceDigest!==review.startSourceDigest||s.fundingSourceDigest!==review.fundingSourceDigest)return fail('mixed_start_source_changed');
  if(!exact(b,['tournamentId','eventId','setupRevisionId','settingsSnapshotId','settingsBindingId','settingsDigest','draft'])||b.tournamentId!==review.tournamentId||b.eventId!==review.eventId||![b.setupRevisionId,b.settingsSnapshotId,b.settingsBindingId].every(uuid)||!hash(b.settingsDigest))return fail('saved_series_binding_required');
  const series=resolveEventSeriesDraftV1(b.draft);if(!series||[series.regular,series.final].some(f=>f.maximumGames*4>10000))return fail('unsupported_saved_series');
  if(!dense(input.roster,18)||input.roster.length!==18||!dense(input.officials,32))return fail('invalid_identity_source');
  const roster:Player[]=[],profiles=new Set<string>();
  for(const p of input.roster){if(!exact(p,['participantId','profileId','mode','fixedTournamentId'])||!uuid(p.participantId)||!['digital','paper'].includes(String(p.mode))||(p.mode==='digital'?!uuid(p.profileId):p.profileId!==null)||typeof p.fixedTournamentId!=='string'||!review.cards.some(c=>c.participantId===p.participantId&&c.fixedTournamentId===p.fixedTournamentId))return fail('invalid_identity_source');if(p.profileId!==null){if(profiles.has(p.profileId as string))return fail('duplicate_profile');profiles.add(p.profileId as string);}roster.push(p as Player);}
  if(new Set(roster.map(p=>p.participantId)).size!==18||roster.filter(p=>p.mode==='digital').length!==6)return fail('invalid_identity_source');
  const officials:Official[]=[],roles=new Set<string>();
  for(const o of input.officials){if(!exact(o,['actorId','participantId','role'])||!uuid(o.actorId)||!['paper-preparer','paper-reviewer'].includes(String(o.role))||(o.participantId!==null&&!roster.some(p=>p.participantId===o.participantId&&p.profileId===o.actorId))||(o.participantId===null&&profiles.has(o.actorId)))return fail('invalid_official_identity');const key=o.actorId+':'+o.role;if(roles.has(key))return fail('duplicate_official_role');roles.add(key);officials.push(o as Official);}
  const ranked=[...review.cards].sort((a,b)=>a.rank-b.rank);if(!ranked.slice(0,5).every((c,i)=>c.rank===i+1))return fail('qualifier_rank_unresolved');
  const players=ranked.slice(0,5).map((c,i)=>({...roster.find(p=>p.participantId===c.participantId)!,seed:i+1,gamePoints:c.gamePoints}));
  const pins={tournamentId:review.tournamentId,eventId:review.eventId,startId:review.startId,reviewDigest:review.sourceDigest,startSourceDigest:review.startSourceDigest,fundingSourceDigest:review.fundingSourceDigest,setupRevisionId:b.setupRevisionId,settingsSnapshotId:b.settingsSnapshotId,settingsBindingId:b.settingsBindingId,settingsDigest:b.settingsDigest};
  const context={version:'native-mixed-five-playoff-context-v1' as const,pins,series,players,officials,roster};
  return{status:'prepared' as const,context:{...context,contextKey:canonical(context)},sourcePointersMustBeServerVerified:true as const,...flags};
 }catch{return fail('invalid_context');}
}

/** Typed rehearsal actions are NOT genuine game attestations. A game projects
 * verified only after all own digital and independent fictional-paper evidence. */
export function projectNativeMixedPlayoffV1(input:unknown,history:unknown){
 try{
  const prepared=prepareNativeMixedPlayoffV1(input);if(prepared.status!=='prepared')return prepared;
  const c=prepared.context;if(!safe(history)||!dense(history,4)||history.some(m=>!obj(m)||!Number.isInteger(m.slot)||Number(m.slot)<1||Number(m.slot)>4)||new Set(history.map(m=>(m as Row).slot)).size!==history.length)return fail('invalid_history');
  const matchResults:Array<{winnerId:string;loserId:string;evidenceNote:string}>=[],matches=[];
  const seen=new Set<string>(),ids=c.players.map(p=>p.participantId);
  for(let slot=1;slot<=4;slot++){
   const participants=slot===1?[ids[3],ids[4]]:slot===2&&matchResults[0]?[ids[0],matchResults[0].winnerId]:slot===3?[ids[2],ids[1]]:slot===4&&matchResults[1]&&matchResults[2]?[matchResults[1].winnerId,matchResults[2].winnerId]:null;
   const m=history.find(m=>(m as Row).slot===slot);if(!m){matches.push({slot,status:participants?'ready':'awaiting-parent',participants,games:[]});continue;}
   if(!participants)return fail('premature_match');
   if(!exact(m,['slot','contextKey','participants','format','games'])||m.slot!==slot||m.contextKey!==c.contextKey||!same(m.participants,participants)||!same(m.format,slot===4?c.series.final:c.series.regular)||!dense(m.games,2500))return fail('match_source_changed');
   const format=slot===4?c.series.final:c.series.regular,verified=[];let incomplete=false;
   for(const [index,g]of m.games.entries()){
    if(incomplete)return fail('game_after_pending_game');
    if(!exact(g,['gameId','gameNumber','actions'])||!uuid(g.gameId)||seen.has(g.gameId)||g.gameNumber!==index+1||!dense(g.actions,6))return fail('invalid_game');seen.add(g.gameId);
    const digital=participants.map(id=>c.players.find(p=>p.participantId===id)!).filter(p=>p.mode==='digital'),paper=participants.filter(id=>!digital.some(p=>p.participantId===id));
    const submits=new Map<string,string>(),confirms=new Set<string>();let winner:string|null=null,capture:Row|null=null,reviewed=false,paperReviewId:string|null=null;
    for(const a of g.actions){
     if(!obj(a)||!uuid(a.id)||seen.has(a.id)||!uuid(a.actorId)||!['digital-submit','digital-confirm','paper-capture','paper-review'].includes(String(a.type)))return fail('invalid_action');seen.add(a.id);
     if(a.type==='digital-submit'){
      if(!exact(a,['id','type','actorId','participantId','winnerParticipantId','statement'])||a.statement!=='simulation-own-playoff-result-v1'||!digital.some(p=>p.participantId===a.participantId&&p.profileId===a.actorId)||submits.has(String(a.participantId))||!participants.includes(a.winnerParticipantId as string)||(winner!==null&&winner!==a.winnerParticipantId))return fail('digital_evidence_mismatch');winner=a.winnerParticipantId as string;submits.set(a.participantId as string,a.id);
     }else if(a.type==='digital-confirm'){
      const evidenceIds=[...submits.values(),...(capture?[capture.id,paperReviewId]:[])].sort();
      if(!exact(a,['id','type','actorId','participantId','submissionId','winnerParticipantId','evidenceIds','statement'])||a.statement!=='simulation-own-playoff-confirmation-v1'||!digital.some(p=>p.participantId===a.participantId&&p.profileId===a.actorId)||submits.get(String(a.participantId))!==a.submissionId||confirms.has(String(a.participantId))||submits.size!==digital.length||(paper.length&&!reviewed)||winner===null||a.winnerParticipantId!==winner||!same(a.evidenceIds,evidenceIds))return fail('digital_confirmation_mismatch');confirms.add(a.participantId as string);
     }else{
      const role=a.type==='paper-capture'?'paper-preparer':'paper-reviewer';
      if(!paper.length||!c.officials.some(o=>o.actorId===a.actorId&&o.role===role)||participants.some(id=>c.roster.find(p=>p.participantId===id)?.profileId===a.actorId))return fail('paper_official_not_independent');
      if(a.type==='paper-capture'){
       if(!exact(a,['id','type','actorId','artifactId','artifactDigest','claims','statement'])||a.statement!=='fictional-playoff-paper-capture-v1'||capture||!uuid(a.artifactId)||seen.has(a.artifactId)||!hash(a.artifactDigest)||!dense(a.claims,2)||a.claims.length!==paper.length)return fail('invalid_paper_capture');seen.add(a.artifactId);
       const claimed=new Set<string>();for(const claim of a.claims){if(!exact(claim,['participantId','winnerParticipantId'])||!paper.includes(claim.participantId as string)||claimed.has(claim.participantId as string)||!participants.includes(claim.winnerParticipantId as string)||(winner!==null&&winner!==claim.winnerParticipantId))return fail('paper_claim_mismatch');claimed.add(claim.participantId as string);winner=claim.winnerParticipantId as string;}capture=a;
      }else if(!exact(a,['id','type','actorId','captureId','artifactId','artifactDigest','reenteredClaims','statement'])||a.statement!=='fictional-playoff-paper-review-v1'||!capture||reviewed||a.actorId===capture.actorId||a.captureId!==capture.id||a.artifactId!==capture.artifactId||a.artifactDigest!==capture.artifactDigest||!same(a.reenteredClaims,capture.claims))return fail('paper_review_mismatch');else{reviewed=true;paperReviewId=a.id;}
     }
    }
    if(winner===null||digital.some(p=>!submits.has(p.participantId)||!confirms.has(p.participantId))||(paper.length&&!reviewed)){incomplete=true;continue;}
    verified.push({gameNumber:index+1,resultId:g.gameId,winnerParticipantId:winner,verification:'verified',evidence:'synthetic-rehearsal'});
   }
   const progress=playoffSeriesProgressV1({format,participants,evidence:'synthetic-rehearsal',games:verified});if(progress.status==='blocked')return fail(progress.code);
   matches.push({slot,status:progress.status,participants,games:verified,progress,pendingGame:incomplete});
   if(progress.status==='complete'){if(incomplete)return fail('game_after_series_complete');const winner=progress.winnerParticipantId!;matchResults[slot-1]={winnerId:winner,loserId:participants.find(id=>id!==winner)!,evidenceNote:'Explicit synthetic mixed playoff series'};}
  }
  const complete=matchResults.length===4&&matchResults.every(Boolean);
  const cohorts=complete?deriveFiveQualifierPlayoff(c.players.map(p=>({participantId:p.participantId,qualificationRank:p.seed,gamePoints:p.gamePoints})),matchResults):null;
  if(complete&&!cohorts)return fail('bracket_path_mismatch');
  return{status:complete?'complete':'in_progress',context:c,matches,byeSeedRanks:[1,2,3],finishingGroups:cohorts?[...new Map(cohorts.map(p=>[p.bandStart,{firstPlace:p.bandStart,lastPlace:p.bandEnd,participantIds:cohorts.filter(x=>x.bandStart===p.bandStart).map(x=>x.participantId)}])).values()]:null,sourcePointersMustBeServerVerified:true,...flags};
 }catch{return fail('invalid_history');}
}
