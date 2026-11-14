// Independent offline answer key. No application imports, database or network.
import {createHash,createHmac} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const oracleVersion='independent-18-mock-oracle-v1';
export const inputTemplate=Object.freeze({version:'mock-trial-oracle-input-v1',seed:'REPLACE-WITH-NONSECRET-STABLE-SIMULATION-SEED',draw:null,digitalResults:Object.freeze([]),funds:Object.freeze([])});
const refs=Object.freeze({scoring:'2025 ACC Rulebook 12.1 and 1.6',qualification:'2025 ACC Rulebook 13.2 and Appendix A item 20',url:'https://cribbage.org/NewSite/rules/rulebook_2025.pdf'});
const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const integer=(v,min=0)=>Number.isSafeInteger(v)&&v>=min;
const fail=code=>{throw new Error(code);};
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:obj(v)?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
const hash=v=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
const total=values=>{let n=0;for(const value of values){if(!integer(value)||!integer(n+value))fail('unsafe_integer_sum');n+=value;}return n;};
const seatNumber=s=>Number(s.split('-')[1]);
// Literal independently transcribed seat movement, not the app's circle engine.
const physicalNext=[0,1,3,5,2,7,4,9,6,11,8,13,10,15,12,17,14,18,16];
export function validateDraw(draw){
 if(!obj(draw)||!obj(draw.anchor)||!Array.isArray(draw.roster)||draw.roster.length!==18||!Array.isArray(draw.games)||draw.games.length!==108)fail('invalid_draw_shape');
 const people=new Map(),fixed=new Set();let digital=0,paper=0,table;
 for(const p of draw.roster){
  if(!obj(p)||!id(p.participantId)||people.has(p.participantId)||typeof p.displayName!=='string'||!p.displayName.trim()||p.displayName.length>160||/[\u0000-\u001f\u007f]/.test(p.displayName)||typeof p.tournamentId!=='string'||!/^([A-Z])-(?:[1-9]|1[0-8])$/.test(p.tournamentId)||fixed.has(p.tournamentId))fail('invalid_roster_identity');
  table??=p.tournamentId[0];if(p.tournamentId[0]!==table)fail('unsupported_multiple_tables');
  if(p.mode==='digital'&&p.fictional===false)digital++;else if(p.mode==='paper'&&p.fictional===true)paper++;else fail('mode_provenance_mismatch');
  people.set(p.participantId,{participantId:p.participantId,tournamentId:p.tournamentId,displayName:p.displayName,mode:p.mode,fictional:p.fictional});fixed.add(p.tournamentId);
 }
 if(digital!==6||paper!==12)fail('requires_six_digital_twelve_fictional_paper');
 if(draw.anchor.seatId!==`${table}-1`||people.get(draw.anchor.participantId)?.tournamentId!==`${table}-1`)fail('unsupported_anchor');
 const games=[],gameIds=new Set(),pairIds=new Set(),rounds=new Map(),opponents=new Map([...people.keys()].map(p=>[p,new Set()]));
 for(const g of draw.games){
  if(!obj(g)||!id(g.gameId)||gameIds.has(g.gameId)||!integer(g.round,1)||g.round>12||!Array.isArray(g.sides)||g.sides.length!==2)fail('invalid_game');
  const round=rounds.get(g.round)??new Map(),sides=[];
  for(const side of g.sides){if(!obj(side)||!people.has(side.participantId)||typeof side.currentSeat!=='string'||!fixed.has(side.currentSeat)||round.has(side.participantId)||[...round.values()].includes(side.currentSeat))fail('invalid_round_occupancy');round.set(side.participantId,side.currentSeat);sides.push({participantId:side.participantId,currentSeat:side.currentSeat});}
  sides.sort((a,b)=>seatNumber(a.currentSeat)-seatNumber(b.currentSeat));
  const [a,b]=sides,n=seatNumber(a.currentSeat);if(a.participantId===b.participantId||n%2!==1||seatNumber(b.currentSeat)!==n+1)fail('invalid_facing_pair');
  const key=[a.participantId,b.participantId].sort().join('|');if(pairIds.has(key))fail('repeated_opponent');pairIds.add(key);opponents.get(a.participantId).add(b.participantId);opponents.get(b.participantId).add(a.participantId);
  if(g.round===1&&sides.some(s=>people.get(s.participantId).tournamentId!==s.currentSeat))fail('first_round_id_mismatch');
  const modes=sides.map(s=>people.get(s.participantId).mode),kind=modes.every(m=>m==='digital')?'DD':modes.every(m=>m==='paper')?'PP':'PD';
  gameIds.add(g.gameId);rounds.set(g.round,round);games.push({gameId:g.gameId,round:g.round,sides,kind});
 }
 if(rounds.size!==12||[...rounds.values()].some(r=>r.size!==18)||[...opponents.values()].some(o=>o.size!==12))fail('incomplete_rounds');
 for(let r=1;r<=12;r++)for(const participantId of people.keys()){
  const current=rounds.get(r).get(participantId);if(participantId===draw.anchor.participantId&&current!==draw.anchor.seatId)fail('anchor_moved');
  if(r<12&&rounds.get(r+1).get(participantId)!==`${table}-${physicalNext[seatNumber(current)]}`)fail('physical_transition_mismatch');
 }
 games.sort((a,b)=>a.round-b.round||seatNumber(a.sides[0].currentSeat)-seatNumber(b.sides[0].currentSeat));
 return {anchor:{participantId:draw.anchor.participantId,seatId:draw.anchor.seatId},roster:[...people.values()].sort((a,b)=>a.participantId<b.participantId?-1:a.participantId>b.participantId?1:0),games,tableId:table};
}
export function reconcileFunds(funds,participantIds){
 if(funds===undefined||funds===null||Array.isArray(funds)&&funds.length===0)return {status:'not-configured',reports:[],moneyMoved:false};
 if(!Array.isArray(funds)||funds.length>100)fail('invalid_funds');
 const fundIds=new Set(),reports=[];
 for(const fund of funds){
  if(!obj(fund)||!id(fund.fundId)||fundIds.has(fund.fundId)||fund.currency!=='USD'||!['unspecified','equal','equal-cohorts','top-double'].includes(fund.method)||!integer(fund.retainedMinor)||!Array.isArray(fund.incomes)||!Array.isArray(fund.expenses)||!Array.isArray(fund.awards))fail('invalid_fund');fundIds.add(fund.fundId);
  const lineIds=new Set(),recipients=new Set(),contributors=new Set();
  for(const [kind,lines]of [['income',fund.incomes],['expense',fund.expenses],['award',fund.awards]]){
   if(lines.length>10000)fail('fund_capacity_exceeded');
   for(const line of lines){if(!obj(line)||!id(line.id)||lineIds.has(line.id)||line.fundId!==fund.fundId||!integer(line.amountMinor))fail('invalid_or_cross_scoped_fund_line');lineIds.add(line.id);
    if(kind==='income'&&!['simulated-contribution','explicit-external'].includes(line.kind))fail('unlabeled_income');
    if(kind==='income'&&line.kind==='simulated-contribution'){if(!participantIds?.has(line.contributorId))fail('unknown_contributor');if(contributors.has(line.contributorId))fail('duplicate_contributor');contributors.add(line.contributorId);}
    if(kind==='award'){if(!participantIds?.has(line.recipientId)||recipients.has(line.recipientId))fail('invalid_award_recipient');recipients.add(line.recipientId);if(line.cohort!==undefined&&!id(line.cohort))fail('invalid_cohort');}
   }
  }
  const incomeMinor=total(fund.incomes.map(x=>x.amountMinor)),expenseMinor=total(fund.expenses.map(x=>x.amountMinor)),awardMinor=total(fund.awards.map(x=>x.amountMinor)),disposed=total([expenseMinor,awardMinor,fund.retainedMinor]),differenceMinor=incomeMinor-disposed;
  let methodCompliance=null;
  if(fund.method==='equal'&&fund.awards.length)methodCompliance=fund.awards.every(a=>a.amountMinor===fund.awards[0].amountMinor);
  if(fund.method==='equal-cohorts'&&fund.awards.length&&fund.awards.every(a=>a.cohort)){const cohorts=new Map();methodCompliance=true;for(const a of fund.awards){if(cohorts.has(a.cohort)&&cohorts.get(a.cohort)!==a.amountMinor)methodCompliance=false;cohorts.set(a.cohort,a.amountMinor);}}
  if(fund.method==='top-double'&&participantIds?.has(fund.topRecipientId)){const top=fund.awards.find(a=>a.recipientId===fund.topRecipientId),others=fund.awards.filter(a=>a.recipientId!==fund.topRecipientId);if(top&&others.length)methodCompliance=others.every(a=>a.amountMinor===others[0].amountMinor)&&top.amountMinor===2*others[0].amountMinor;}
  reports.push({fundId:fund.fundId,currency:'USD',incomeMinor,expenseMinor,awardMinor,retainedMinor:fund.retainedMinor,differenceMinor,balance:differenceMinor===0?'balanced':differenceMinor>0?'unallocated':'overallocated',fiveDollarAwards:fund.awards.every(a=>a.amountMinor%500===0),method:fund.method,methodCompliance,policyStatus:'unresolved-not-approved',provenance:'caller-proposed-simulated-fund',actualPaid:false,moneyMoved:false});
 }
 return {status:'compared',reports,moneyMoved:false};
}
export function rankKnownCards(cards,games,results){
 const sorted=[...cards].sort((a,b)=>b.totals.gamePoints-a.totals.gamePoints||b.totals.wins-a.totals.wins||b.totals.netSpreadPoints-a.totals.netSpreadPoints||b.totals.plusPoints-a.totals.plusPoints),groups=[];let place=1;
 for(const card of sorted){const keys=[card.totals.gamePoints,card.totals.wins,card.totals.netSpreadPoints,card.totals.plusPoints],prior=groups.at(-1);if(prior&&canonical(prior.keys)===canonical(keys)){prior.participantIds.push(card.participantId);prior.placeEnd++;}else groups.push({keys,placeStart:place,placeEnd:place,participantIds:[card.participantId]});place++;}
 for(const group of groups){group.tied=group.participantIds.length>1;group.resolutionRequired=null;group.headToHeadEvidence=null;if(group.tied){const match=group.participantIds.length===2?games.find(g=>g.sides.every(s=>group.participantIds.includes(s.participantId))):null,result=match&&results.get(match.gameId);if(result){group.headToHeadEvidence={gameId:match.gameId,winnerId:result.winnerId,source:result.source,humanPlayVerified:false};group.resolutionRequired='review-head-to-head';}else group.resolutionRequired=group.participantIds.length===2?'deciding-game-required':'head-judge-review';}}
 return {displayOrderWithinTies:'noncompetitive-not-a-tiebreak',rows:sorted.map(c=>({participantId:c.participantId,tournamentId:c.tournamentId,displayName:c.displayName,totals:c.totals,placeStart:groups.find(g=>g.participantIds.includes(c.participantId)).placeStart,placeEnd:groups.find(g=>g.participantIds.includes(c.participantId)).placeEnd})),groups};
}
export function compareAppExport(appExport,expectedGames,cards,identity){
 if(appExport===undefined||appExport===null)return {status:'not-compared'};
 if(!obj(appExport)||!Array.isArray(appExport.games)||!Array.isArray(appExport.totals))fail('invalid_app_export');
 if(!identity||['oracleVersion','drawHash','planHash'].some(k=>appExport[k]!==identity[k]))return {status:'source-mismatch',issues:[{kind:'source-version-or-hash-mismatch'}],officialVerificationClaimed:false};
 const issues=[],seenGames=new Set(),seenPeople=new Set(),expected=new Map(expectedGames.map(g=>[g.gameId,g])),totals=new Map(cards.map(c=>[c.participantId,c.totals]));
 for(const g of appExport.games){if(!obj(g)||!id(g.gameId))fail('invalid_app_game');if(seenGames.has(g.gameId)){issues.push({kind:'duplicate-game',gameId:g.gameId});continue;}seenGames.add(g.gameId);const e=expected.get(g.gameId);if(!e)issues.push({kind:'unexpected-game',gameId:g.gameId});else if(e.winnerId===null)issues.push({kind:'oracle-result-pending',gameId:g.gameId});else if(g.winnerId!==e.winnerId||g.spreadPoints!==e.spreadPoints)issues.push({kind:'game-mismatch',gameId:g.gameId});}
 for(const [gameId,e]of expected)if(e.winnerId!==null&&!seenGames.has(gameId))issues.push({kind:'missing-game',gameId});
 for(const row of appExport.totals){if(!obj(row)||!id(row.participantId))fail('invalid_app_total');if(seenPeople.has(row.participantId)){issues.push({kind:'duplicate-total',participantId:row.participantId});continue;}seenPeople.add(row.participantId);const e=totals.get(row.participantId);if(!e)issues.push({kind:'unexpected-total',participantId:row.participantId});else if(['knownGames','pendingGames','gamePoints','wins','plusPoints','minusPoints','netSpreadPoints'].some(k=>row[k]!==e[k]))issues.push({kind:'total-mismatch',participantId:row.participantId});}
 for(const participantId of totals.keys())if(!seenPeople.has(participantId))issues.push({kind:'missing-total',participantId});
 return {status:issues.length?'differences':'matched-known-results',issues,officialVerificationClaimed:false};
}
export function buildAnswerKey(input){
 if(!obj(input)||input.version!=='mock-trial-oracle-input-v1'||typeof input.seed!=='string'||input.seed.length<1||input.seed.length>4096)fail('invalid_input');
 const draw=validateDraw(input.draw),people=new Map(draw.roster.map(p=>[p.participantId,p]));
 const drawIdentity={anchor:draw.anchor,roster:draw.roster.map(p=>({participantId:p.participantId,tournamentId:p.tournamentId,mode:p.mode,fictional:p.fictional})),games:draw.games},drawHash=hash(drawIdentity),seedHash=hash(input.seed),results=new Map(),syntheticGamePlan=[];
 for(const g of draw.games)if(g.kind!=='DD'){const bytes=createHmac('sha256',input.seed).update(canonical({version:oracleVersion,drawHash,gameId:g.gameId})).digest(),winnerId=g.sides[bytes[4]%2].participantId,spreadPoints=1+bytes.readUInt32BE(0)%121,result={gameId:g.gameId,winnerId,spreadPoints,source:'synthetic-script',synthetic:true,humanPlayVerified:false};results.set(g.gameId,result);syntheticGamePlan.push(result);}
 const planHash=hash({version:oracleVersion,drawHash,seedHash,syntheticGamePlan}),provided=input.digitalResults??[];
 if(!Array.isArray(provided))fail('invalid_digital_results');
 for(const r of provided){const g=draw.games.find(g=>g.gameId===r?.gameId);if(!obj(r)||!g||g.kind!=='DD'||results.has(r.gameId)||!g.sides.some(s=>s.participantId===r.winnerId)||!integer(r.spreadPoints,1)||r.spreadPoints>121)fail('invalid_or_duplicate_digital_result');results.set(r.gameId,{gameId:r.gameId,winnerId:r.winnerId,spreadPoints:r.spreadPoints,source:'caller-supplied-dd-result',synthetic:false,humanPlayVerified:false});}
 const cards=draw.roster.map(p=>{const rows=draw.games.filter(g=>g.sides.some(s=>s.participantId===p.participantId)).map(g=>{const own=g.sides.find(s=>s.participantId===p.participantId),other=g.sides.find(s=>s.participantId!==p.participantId),r=results.get(g.gameId),won=r?.winnerId===p.participantId;return {round:g.round,currentSeat:own.currentSeat,opponentTournamentId:people.get(other.participantId).tournamentId,kind:g.kind,gameId:g.gameId,gamePoints:r?(won?(r.spreadPoints>=31?3:2):0):null,plusPoints:r?(won?r.spreadPoints:0):null,minusPoints:r?(won?0:r.spreadPoints):null,signedSpreadPoints:r?(won?r.spreadPoints:-r.spreadPoints):null,won:r?won:null,synthetic:g.kind!=='DD',evidenceSource:r?.source??'pending-dd',humanPlayVerified:false};});const known=rows.filter(r=>r.gamePoints!==null),totals={knownGames:known.length,pendingGames:12-known.length,gamePoints:total(known.map(r=>r.gamePoints)),wins:known.filter(r=>r.won).length,plusPoints:total(known.map(r=>r.plusPoints)),minusPoints:total(known.map(r=>r.minusPoints))};totals.netSpreadPoints=totals.plusPoints-totals.minusPoints;return {...p,rows,totals,cardHash:hash({version:oracleVersion,planHash,participantId:p.participantId,tournamentId:p.tournamentId,rows,totals})};});
 const paperCards=cards.filter(p=>p.mode==='paper'),digitalDigitalLog=draw.games.filter(g=>g.kind==='DD').map(g=>{const r=results.get(g.gameId);return {...g,sides:g.sides.map(s=>({...s,tournamentId:people.get(s.participantId).tournamentId})),winnerId:r?.winnerId??null,spreadPoints:r?.spreadPoints??null,status:r?'caller-supplied':'pending',humanPlayVerified:false,officialVerificationClaimed:false};});
 const completion={knownGameCount:results.size,pendingDigitalDigitalCount:digitalDigitalLog.filter(g=>g.status==='pending').length,all108ResultsKnown:results.size===108,humanPlayVerified:false,officialVerificationClaimed:false};
 const standings=rankKnownCards(cards,draw.games,results),qualifierCount=Math.ceil(18/4),unresolved=standings.groups.some(g=>g.tied&&g.placeStart<=qualifierCount);
 standings.status=completion.all108ResultsKnown?'complete-inputs-not-verified':'known-subtotals-not-final';
 standings.qualification={status:!completion.all108ResultsKnown?'pending-digital-results':unresolved?'unresolved-ties':'calculated-not-approved',qualifierCount,qualifierIds:completion.all108ResultsKnown&&!unresolved?standings.groups.filter(g=>g.placeEnd<=qualifierCount).flatMap(g=>g.participantIds):null,officialApprovalClaimed:false};
 const expectedGamePoints=total([...results.values()].map(r=>r.spreadPoints>=31?3:2)),cardGamePoints=total(cards.map(c=>c.totals.gamePoints)),plusPoints=total(cards.map(c=>c.totals.plusPoints)),minusPoints=total(cards.map(c=>c.totals.minusPoints));if(expectedGamePoints!==cardGamePoints||plusPoints!==minusPoints)fail('independent_score_conservation_failed');
 const reconciliation={knownGameCount:results.size,expectedGamePoints,totalCardGamePoints:cardGamePoints,plusPoints,minusPoints,netSpreadPoints:plusPoints-minusPoints,balanced:true,scope:completion.all108ResultsKnown?'all-supplied-results':'known-results-only'};
 const expectedGames=draw.games.map(g=>({gameId:g.gameId,winnerId:results.get(g.gameId)?.winnerId??null,spreadPoints:results.get(g.gameId)?.spreadPoints??null}));
 return {version:oracleVersion,inputHash:hash(input),drawHash,seedHash,planHash,resultHash:hash([...results.values()].sort((a,b)=>a.gameId<b.gameId?-1:a.gameId>b.gameId?1:0)),syntheticGamePlan,paperCards,digitalDigitalLog,cards,standings,completion,reconciliation,funds:reconcileFunds(input.funds,new Set(people.keys())),appComparison:compareAppExport(input.appExport,expectedGames,cards,{oracleVersion,drawHash,planHash}),ruleReferences:refs,claims:{seatingGenerated:false,drawRandomnessVerified:false,humanPlayVerified:false,independentWitnessClaimed:false,officialResultsApproved:false,moneyMoved:false},physicalRoomVerified:false};
}
export function csvCell(value){const text=String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,4096),safe=/^[\s]*[=+@-]/.test(text)?`'${text}`:text;return `"${safe.replaceAll('"','""')}"`;}
function cli(args){
 if(args.length===2&&args[0]==='--template'){fs.writeFileSync(path.resolve(args[1]),JSON.stringify(inputTemplate,null,2),{flag:'wx'});return;}
 if(args.length!==4||args[0]!=='--input'||args[2]!=='--output')fail('usage: --template NEW_FILE or --input FILE --output NEW_DIRECTORY');
 const answer=buildAnswerKey(JSON.parse(fs.readFileSync(path.resolve(args[1]),'utf8'))),out=path.resolve(args[3]);fs.mkdirSync(out);
 const write=(name,data)=>fs.writeFileSync(path.join(out,name),data,{flag:'wx'});
 write('answer-key.json',JSON.stringify(answer,null,2));
 const csv=[['Tournament ID','Display name','Round','Current seat','Opponent Tournament ID','Kind','Game ID','Game points','Positive spread points','Negative spread points']];for(const c of answer.paperCards)for(const r of c.rows)csv.push([c.tournamentId,c.displayName,r.round,r.currentSeat,r.opponentTournamentId,r.kind,r.gameId,r.gamePoints,r.plusPoints,r.minusPoints]);write('paper-cards.csv',csv.map(row=>row.map(csvCell).join(',')).join('\r\n'));
 write('validation.json',JSON.stringify({completion:answer.completion,reconciliation:answer.reconciliation,funds:answer.funds,qualification:answer.standings.qualification,claims:answer.claims},null,2));
 const files=fs.readdirSync(out).sort();write('hashes.json',JSON.stringify(Object.fromEntries(files.map(name=>[name,hash(fs.readFileSync(path.join(out,name)).toString('utf8'))])),null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{cli(process.argv.slice(2));}catch(error){process.stderr.write(`${error.message}\n`);process.exitCode=1;}}
