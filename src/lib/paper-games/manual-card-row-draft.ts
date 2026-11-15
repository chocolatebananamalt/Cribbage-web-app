import {isDraftScoreCells} from './ocr-draft.ts';
import {deriveScore} from '../score.ts';

export type ManualCardCells={gamePoints:string;plusPoints:string;minusPoints:string};
export type ManualCardTarget={side:'a'|'b';gameNumber:number;fixedTournamentId:string;opponentFixedTournamentId:string};
/** Human transcription only. Shared draft contract does not imply OCR was run.
 * Identity comes from the current host, never a name/ID read from an image.
 * A returned draft is not evidence, verification, a save request or permission. */
export function reviewManualCardRow(target:ManualCardTarget,cells:ManualCardCells){
 try{
  if(!['a','b'].includes(target.side)||!Number.isInteger(target.gameNumber)||target.gameNumber<1||target.gameNumber>22||![target.fixedTournamentId,target.opponentFixedTournamentId].every(v=>typeof v==='string'&&/^[A-Z]-[1-9]\d*$/.test(v))||target.fixedTournamentId===target.opponentFixedTournamentId)return null;
  if(!['0','2','3'].includes(cells.gamePoints))return null;
  const point=(s:string)=>s===''?null:/^\d{1,3}$/.test(s)&&Number(s)>=1&&Number(s)<=121?Number(s):NaN;
  const plus=point(cells.plusPoints),minus=point(cells.minusPoints);
  if((plus===null)===(minus===null))return null;
  const row={gamePoints:Number(cells.gamePoints),plusPoints:plus,minusPoints:minus};
  if(!isDraftScoreCells(row))return null;
  const score=deriveScore((plus??minus)!,plus===null?'opponent':'player');
  if(score.playerGamePoints!==row.gamePoints)return null;
  return{winnerSide:plus!==null?target.side:target.side==='a'?'b' as const:'a' as const,margin:score.margin,gamePoints:score.playerGamePoints,plusPoints:plus,minusPoints:minus,source:'human-local-photo-transcription' as const,humanReviewRequired:true as const,authoritative:false as const};
 }catch{return null;}
}
