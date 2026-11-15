import 'server-only';
import {createHash} from 'node:crypto';
import {projectExistingPlayoffReadModels,type ExistingPlayoffMode,type ExistingPlayoffReadModels,type ExistingBracketOrigin} from '../results/player-playoff-read-model.ts';
import {projectPlayerPlayoff,type PlayoffDisplayInput} from '../results/player-playoff-display.ts';
import {groupEliminationCohorts} from '../results/playoff-rounds-won.ts';
import {isRestorableEventFinanceEditorV1} from './event-finance-draft-codec-v1.ts';
import {assembleNativeOperationalFinanceV1} from './operational-finance-native-assembler-v1.ts';
import {projectOperationalFinanceEstimateV1} from './operational-finance-estimate-basis-v1.ts';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>obj(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>obj(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const noAuthority={writeAuthorized:false as const,payoutAuthorized:false as const,finalizationAuthorized:false as const,moneyMoved:false as const,publicAccessGranted:false as const};
export type FinalRecipientEstimateInputV1={scope:{actorId:string;tournamentId:string;eventId:string};nativeFinanceSource:unknown;proposal:unknown;expectedHead:{revisionId:string;version:number};playoffMode:ExistingPlayoffMode;playoffModels:ExistingPlayoffReadModels};
export type RecipientBracketEvidenceV1={input:PlayoffDisplayInput;origin:ExistingBracketOrigin|'native-digital-protocol-origin-unverified';notice:string;nativeBinding?:unknown};
export type RecipientFinanceInputV1=Pick<FinalRecipientEstimateInputV1,'scope'|'nativeFinanceSource'|'proposal'|'expectedHead'>;
/** Private, read-only mapping of separately supplied current models. It does NOT
 * prove atomic reads, authorize awards, establish physical play, or disburse funds.
 * A future writer must re-read/lock these exact heads; this function creates no route. */
export function projectRecipientEstimateFromBracketV1(input:RecipientFinanceInputV1,evidence:RecipientBracketEvidenceV1){
 const fail=(code:string)=>({status:'blocked' as const,code,...noAuthority});
 const finance=assembleNativeOperationalFinanceV1(input.nativeFinanceSource,input.scope);if(!finance)return fail('finance_source_unavailable');
 const p=input.proposal;
 if(!exact(p,['revisionId','version','sourceDigest','basisDigest','qualificationResultVersionId','editor'])||!uuid(p.revisionId)||!Number.isSafeInteger(p.version)||Number(p.version)<1||Number(p.version)>2147483647||!uuid(p.qualificationResultVersionId)||!isRestorableEventFinanceEditorV1(p.editor))return fail('invalid_proposal_revision');
 if(p.revisionId!==input.expectedHead.revisionId||p.version!==input.expectedHead.version||p.sourceDigest!==finance.basis.sourceDigest||p.basisDigest!==finance.basisDigest||canonical(p.editor.basis)!==canonical(finance.basis.workspace))return fail('proposal_source_changed');
 const raw=(input.nativeFinanceSource as {raw:{qualification:null|{resultVersionId:string;participantCount:number}}}).raw;
 if(raw.qualification===null||raw.qualification.resultVersionId!==p.qualificationResultVersionId)return fail('qualification_source_changed');
 const display=projectPlayerPlayoff(evidence.input);if(display.status!=='available')return fail(display.code);
 const bracket={...evidence,display};
 if(bracket.input.tournamentId!==input.scope.tournamentId||bracket.input.eventId!==input.scope.eventId)return fail('playoff_scope_changed');
 if(bracket.input.qualificationVersionId!==p.qualificationResultVersionId||bracket.input.qualifierCount!==finance.basis.workspace.qualifierCount||bracket.input.entrantCount!==raw.qualification.participantCount)return fail('qualification_source_changed');
 if((finance.basis.workspace.eventKind==='consolation')!==(bracket.input.eventType==='regular-consolation'))return fail('event_type_changed');
 if(!bracket.display.champion)return fail('playoffs_incomplete');
 const matches=bracket.display.rounds.flatMap(r=>r.matches);
 if(matches.some(m=>m.status!=='recorded'&&m.status!=='bye')||bracket.input.results.length!==bracket.input.players.length-1)return fail('playoffs_incomplete');
 const eliminations=new Map<string,number>();
 for(const m of matches){if(m.status==='bye')continue;if(!m.result||!m.winnerId)return fail('playoffs_incomplete');const loser=m.sides.find(s=>s.player?.participantId!==m.winnerId)?.player;if(!loser||eliminations.has(loser.participantId))return fail('elimination_source_conflict');eliminations.set(loser.participantId,m.round);}
 if(eliminations.size!==bracket.input.players.length-1||eliminations.has(bracket.display.champion.participantId))return fail('elimination_source_conflict');
 const cohorts=groupEliminationCohorts(bracket.input.players.map(player=>({participantId:player.participantId,eliminatedInRound:eliminations.get(player.participantId)??null})));
 const view=projectOperationalFinanceEstimateV1(p.editor,finance.basis)?.proposal;
 if(!view||view.blocked||!view.canEditPayout||view.adjustedTotalMinor===null)return fail('payout_basis_unavailable');
 if(p.editor.lineForm!==null||p.editor.bandForm!==null)return fail('unfinished_proposal_form');
 const groups=cohorts.map(c=>{const band=view.payoutBands.find(b=>b.firstPlace===c.bandStart&&b.lastPlace===c.bandEnd);return{firstPlace:c.bandStart,lastPlace:c.bandEnd,included:!!band,perPersonMinor:band?.adjustedPerPersonMinor??0,participantIds:c.participantIds};});
 if(view.payoutBands.some(b=>!groups.some(g=>g.firstPlace===b.firstPlace&&g.lastPlace===b.lastPlace&&g.participantIds.length===b.people))||groups.some(g=>g.perPersonMinor%500!==0))return fail('finishing_group_mismatch');
 const recipients=groups.flatMap(g=>g.participantIds.map(participantId=>{const player=bracket.input.players.find(p=>p.participantId===participantId)!;return{participantId,tournamentPlayerId:player.tournamentId,displayName:player.displayName,firstPlace:g.firstPlace,lastPlace:g.lastPlace,included:g.included,amountMinor:g.perPersonMinor};}));
 const total=recipients.reduce((sum,r)=>sum+BigInt(r.amountMinor),BigInt(0));if(total!==BigInt(view.adjustedTotalMinor))return fail('recipient_total_mismatch');
 const resultBindings=bracket.input.results.map(r=>({matchId:r.matchId,resultId:r.resultId,revision:r.revision,sourceSeriesOrdinal:r.sourceSeriesOrdinal}));
 const proposalContentDigest=createHash('sha256').update(canonical(p)).digest('hex');
 const playoffContentDigest=createHash('sha256').update(canonical({input:bracket.input,origin:bracket.origin,...(bracket.nativeBinding===undefined?{}:{nativeBinding:bracket.nativeBinding})})).digest('hex');
 const binding={tournamentId:input.scope.tournamentId,eventId:input.scope.eventId,proposalRevisionId:p.revisionId,proposalVersion:p.version,proposalContentDigest,financeSourceDigest:p.sourceDigest,basisDigest:p.basisDigest,qualificationResultVersionId:p.qualificationResultVersionId,playoffSourceDigest:bracket.input.sourceDigest,playoffContentDigest,resultBindings};
 const digest=createHash('sha256').update(canonical({version:'final-recipient-estimate-v1',binding,groups,recipients})).digest('hex');
 return{status:'recipient_estimate' as const,version:'final-recipient-estimate-v1' as const,currency:'USD' as const,digest,binding,groups,recipients,totalMinor:Number(total),fundMinor:view.fundMinor,differenceMinor:view.differenceMinor,balanced:view.differenceMinor===0,requestedPaidPlaces:view.requestedPaidPlaces,includedPaidPlaces:view.actualPaidPlaces,positiveAwardPlaces:view.positiveAwardPlaces,warnings:[...view.warnings],origin:bracket.origin,notice:bracket.notice,recordedFundAvailable:false as const,sourceObservation:'provided-models-not-atomic' as const,independentPlayEstablished:false as const,...noAuthority};
}

/** Existing aggregate adapter stays separate from native game-level evidence. */
export function projectFinalRecipientEstimateV1(input:FinalRecipientEstimateInputV1){
 const bracket=projectExistingPlayoffReadModels(input.scope.tournamentId,input.scope.eventId,input.playoffMode,input.playoffModels);
 if(bracket.status!=='available')return{status:'blocked' as const,code:bracket.code,...noAuthority};
 return projectRecipientEstimateFromBracketV1(input,{input:bracket.input,origin:bracket.origin,notice:bracket.notice});
}
