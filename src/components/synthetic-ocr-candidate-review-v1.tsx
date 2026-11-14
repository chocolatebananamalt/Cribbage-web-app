'use client';
import{useLayoutEffect,useRef,useState}from'react';
import{acceptSyntheticOcrCellsV1,isSyntheticOcrBindingV1,makeSyntheticOcrCandidateV1,readSyntheticOcrCandidateV1,type SyntheticOcrBindingV1,type SyntheticOcrCandidateV1}from'../lib/paper-games/synthetic-ocr-review-v1';
import type{ManualCardCells}from'../lib/paper-games/manual-card-row-draft';
type Props={enabled?:boolean;inputId:string;binding:SyntheticOcrBindingV1;disabled:boolean;permitted:()=>boolean;subscribeRevocation:(revoke:()=>void)=>()=>void;onAccept:(cells:ManualCardCells)=>boolean;onInvalidate:()=>void};
const blank=():ManualCardCells=>({gamePoints:'',plusPoints:'',minusPoints:''});
export function SyntheticOcrCandidateReviewV1(p:Props){if(p.enabled!==true||!isSyntheticOcrBindingV1(p.binding))return null;return <Review key={JSON.stringify([p.binding,p.disabled])} {...p}/>;}
function Review({inputId,binding,disabled,permitted,subscribeRevocation,onAccept,onInvalidate}:Props){
 const[candidate,setCandidate]=useState<SyntheticOcrCandidateV1|null>(null),[cells,setCells]=useState(blank),[checked,setChecked]=useState(false),[accepted,setAccepted]=useState(false),[hidden,setHidden]=useState(false);
 const latest=useRef<object|null>(null),revoked=useRef(false),region=useRef<HTMLDivElement>(null),lease={binding,disabled,permitted,candidate,cells,checked,onAccept,onInvalidate};
 useLayoutEffect(()=>{latest.current=lease;return()=>{if(latest.current===lease)latest.current=null;};});
 useLayoutEffect(()=>{const revoke=()=>{revoked.current=true;latest.current=null;if(region.current)region.current.hidden=true;setHidden(true);setCandidate(null);setCells(blank());setChecked(false);setAccepted(false);};const off=subscribeRevocation(revoke);window.addEventListener('pagehide',revoke);return()=>{latest.current=null;off();window.removeEventListener('pagehide',revoke);};},[subscribeRevocation]);
 function current(){try{return!revoked.current&&latest.current===lease&&!disabled&&permitted()===true;}catch{return false;}}
 function invalidate(){latest.current=null;setChecked(false);setAccepted(false);onInvalidate();}
 const c=readSyntheticOcrCandidateV1(candidate,binding),row=c?.draft.rows[0],valid=c&&acceptSyntheticOcrCellsV1(c,binding,cells,checked);
 return <div ref={region} hidden={hidden} className="synthetic-ocr-candidate"><fieldset disabled={disabled}><legend>OCR Candidate Review — Synthetic Preview</legend><p>No recognition was run. This example did not read or transmit your photo. Its sample values may be wrong.</p>
 <p>Card {binding.scope.fixedTournamentId}; opponent {binding.scope.opponentFixedTournamentId}; Game {binding.scope.gameNumber}. Expected identifiers come from the current assignment, not the image.</p>
 <button type="button" onClick={()=>{if(current()){invalidate();setCandidate(makeSyntheticOcrCandidateV1(binding));setCells(blank());}}}>Show Synthetic Candidate</button>
 {c&&row&&<><p role="status">Uncertain image example. Synthetic confidence {Math.round(row.confidence*100)}% — not a calibrated recognition score.</p><dl><dt>Candidate Game Points — Uncertain</dt><dd>{row.gamePoints??'Unknown'}</dd><dt>Candidate Plus Spread — Uncertain</dt><dd>{row.plusPoints??'Unknown'}</dd><dt>Candidate Minus Spread — Uncertain</dt><dd>{row.minusPoints??'Unknown'}</dd></dl>{c.draft.warnings.map((w,i)=><p key={i}>{w}</p>)}
 <p>Enter corrected values yourself from this photo. Nothing is copied automatically.</p>
 <label htmlFor={`${inputId}-ocr-gp`}>Corrected Game Points</label><select id={`${inputId}-ocr-gp`} value={cells.gamePoints} onChange={e=>{if(current()){invalidate();setCells({...cells,gamePoints:e.target.value});}}}><option value="">Choose the Written Value</option><option value="0">0</option><option value="2">2</option><option value="3">3</option></select>
 {(['plusPoints','minusPoints']as const).map((name,i)=><span key={name}><label htmlFor={`${inputId}-ocr-${name}`}>Corrected {i===0?'Plus':'Minus'} Spread</label><input id={`${inputId}-ocr-${name}`} inputMode="numeric" maxLength={3} autoComplete="off" value={cells[name]} onChange={e=>{if(current()){invalidate();setCells({...cells,[name]:e.target.value.replace(/\D/g,'').slice(0,3)});}}}/></span>)}
 <label className="draft-confirmation"><input type="checkbox" checked={checked} onChange={e=>{if(current()){latest.current=null;setChecked(e.target.checked);setAccepted(false);onInvalidate();}}}/><span>I checked this photo&apos;s player ID, opponent ID and game number, and corrected or independently re-entered every value above.</span></label>
 <button type="button" disabled={disabled||!valid||accepted} onClick={()=>{if(current()&&valid&&!accepted){latest.current=null;setChecked(false);setAccepted(onAccept(valid)===true);}}}>Accept Corrected Candidate as Text Draft</button>
 {accepted&&<p role="status">Corrected text copied to the manual draft. Review it there and confirm again. No score was saved or verified.</p>}
 </>}
 </fieldset></div>;
}
