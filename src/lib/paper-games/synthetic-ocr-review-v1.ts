import{isOcrDraft,type OcrDraft}from'./ocr-draft.ts';
import{isPaperPhotoTextScopeV1,type PaperPhotoTextScopeV1}from'./paper-photo-text-draft-v1.ts';
import{reviewManualCardRow,type ManualCardCells,type ManualCardTarget}from'./manual-card-row-draft.ts';
export const syntheticOcrCandidateReviewEnabledV1=()=>false;
export type SyntheticOcrBindingV1={scope:PaperPhotoTextScopeV1;selectionId:number};
export type SyntheticOcrCandidateV1={kind:'synthetic-ocr-candidate-v1';binding:SyntheticOcrBindingV1;source:'synthetic-fixture-only';draft:OcrDraft};
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export function isSyntheticOcrBindingV1(v:unknown):v is SyntheticOcrBindingV1{return exact(v,['scope','selectionId'])&&isPaperPhotoTextScopeV1(v.scope)&&Number.isSafeInteger(v.selectionId)&&Number(v.selectionId)>0;}
/** No photo input or recognition. Fixture values are unrelated to image contents. */
export function makeSyntheticOcrCandidateV1(binding:SyntheticOcrBindingV1):SyntheticOcrCandidateV1|null{
 if(!isSyntheticOcrBindingV1(binding))return null;
 return{kind:'synthetic-ocr-candidate-v1',binding:structuredClone(binding),source:'synthetic-fixture-only',draft:{authoritative:false,humanReviewRequired:true,sourceImageQuality:'uncertain',playerName:null,verificationId:null,rows:[{gameNumber:binding.scope.gameNumber,gamePoints:2,plusPoints:29,minusPoints:null,opponentName:null,opponentVerificationId:null,confidence:0.55}],warnings:['Synthetic uncertainty example. Values were not read from this photo.']}};
}
export function readSyntheticOcrCandidateV1(v:unknown,binding:SyntheticOcrBindingV1):SyntheticOcrCandidateV1|null{
 if(!isSyntheticOcrBindingV1(binding)||!exact(v,['kind','binding','source','draft'])||v.kind!=='synthetic-ocr-candidate-v1'||v.source!=='synthetic-fixture-only'||!isSyntheticOcrBindingV1(v.binding)||canonical(v.binding)!==canonical(binding)||!isOcrDraft(v.draft)||v.draft.rows.length!==1||v.draft.rows[0].gameNumber!==binding.scope.gameNumber||v.draft.playerName!==null||v.draft.verificationId!==null||v.draft.rows[0].opponentName!==null||v.draft.rows[0].opponentVerificationId!==null)return null;
 return structuredClone(v)as SyntheticOcrCandidateV1;
}
export function acceptSyntheticOcrCellsV1(candidate:unknown,binding:SyntheticOcrBindingV1,cells:ManualCardCells,identityAndCorrectionChecked:boolean):ManualCardCells|null{
 const c=readSyntheticOcrCandidateV1(candidate,binding);if(!c||c.draft.sourceImageQuality==='unreadable'||identityAndCorrectionChecked!==true)return null;
 const s=binding.scope,target:ManualCardTarget={side:s.side,gameNumber:s.gameNumber,fixedTournamentId:s.fixedTournamentId,opponentFixedTournamentId:s.opponentFixedTournamentId};
 return reviewManualCardRow(target,cells)?structuredClone(cells):null;
}
