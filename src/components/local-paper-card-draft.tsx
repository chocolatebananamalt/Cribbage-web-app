'use client';
import{useEffect,useLayoutEffect,useRef,useState}from'react';
import{SyntheticOcrCandidateReviewV1}from'./synthetic-ocr-candidate-review-v1';
import{isPaperPhotoTextScopeV1}from'../lib/paper-games/paper-photo-text-draft-v1';
import{LocalPaperCardPhoto}from'./local-paper-card-photo';
import{reviewManualCardRow,type ManualCardCells,type ManualCardTarget}from'../lib/paper-games/manual-card-row-draft';
import{PaperPhotoTextDraftV1,type PaperPhotoTextScopeV1,type PaperPhotoTextSnapshotV1}from'../lib/paper-games/paper-photo-text-draft-v1';
import type{SeriesGameRetainedPortV1}from'../lib/playoffs/series-game-retained-v1';

const blank=():ManualCardCells=>({gamePoints:'',plusPoints:'',minusPoints:''});
/** Photo is memory-only; explicitly saved text can be recovered only into this
 * owner's current card/source, never another reviewer's answer or a writer. */
type Props={inputId:string;label:string;target:ManualCardTarget;disabled:boolean;permitted:()=>boolean;subscribeRevocation:(revoke:()=>void)=>()=>void;onApply:(winner:'a'|'b',margin:number)=>void;onInvalidate:()=>void;retention?:{scope:PaperPhotoTextScopeV1;port:SeriesGameRetainedPortV1};ocrReview?:{enabled?:boolean;scope:PaperPhotoTextScopeV1}};
export function LocalPaperCardDraft(p:Props){return <ActiveDraft key={JSON.stringify([p.target,p.retention?.scope,p.ocrReview?.scope])} {...p}/>;}
function ActiveDraft({inputId,label,target,disabled,permitted,subscribeRevocation,onApply,onInvalidate,retention,ocrReview}:Props){
 const [selectionId,setSelectionId]=useState(0),selectionSequence=useRef(0);
 const [selected,setSelected]=useState(false),[cells,setCells]=useState<ManualCardCells>(blank),[confirmed,setConfirmed]=useState(false),[hidden,setHidden]=useState(false),[notice,setNotice]=useState('');
 const alive=useRef(false),revoked=useRef(false),latest=useRef<object|null>(null),region=useRef<HTMLDivElement>(null);
 const [saved,setSaved]=useState<{key:string;snapshot:PaperPhotoTextSnapshotV1}|null>(null),[storageBusy,setStorageBusy]=useState(false),[removeConfirmed,setRemoveConfirmed]=useState(false);
 const store=useRef<{key:string;value:PaperPhotoTextDraftV1}|null>(null),storageFlight=useRef<object|null>(null),permission=useRef<{key:string;disabled:boolean;permitted:()=>boolean}|null>(null);
 const key=retention?JSON.stringify(retention.scope):'',port=retention?.port;
 const draft=reviewManualCardRow(target,cells),lease={target,disabled,permitted,onApply,onInvalidate,selected,cells,confirmed,key,storageBusy,removeConfirmed};
 useLayoutEffect(()=>{const p={key,disabled,permitted};permission.current=p;return()=>{if(permission.current===p)permission.current=null;};},[key,disabled,permitted]);
 useLayoutEffect(()=>{latest.current=lease;return()=>{if(latest.current===lease)latest.current=null;};});
 useLayoutEffect(()=>{alive.current=true;const revoke=()=>{revoked.current=true;latest.current=null;store.current?.value.dispose();storageFlight.current=null;if(region.current)region.current.hidden=true;if(alive.current){setHidden(true);setCells(blank());setConfirmed(false);setSelected(false);setNotice('');}};const off=subscribeRevocation(revoke);window.addEventListener('pagehide',revoke);return()=>{alive.current=false;latest.current=null;off();window.removeEventListener('pagehide',revoke);};},[subscribeRevocation]);
 useEffect(()=>{if(!key||!port)return;let owned:{key:string;value:PaperPhotoTextDraftV1};try{const scope=JSON.parse(key);owned={key,value:new PaperPhotoTextDraftV1({scope,port,enabled:()=>{const p=permission.current;try{return alive.current&&!revoked.current&&store.current===owned&&p?.key===key&&!p.disabled&&p.permitted()===true;}catch{return false;}}})};}catch{return;}store.current=owned;void owned.value.load().then(()=>{if(alive.current&&!revoked.current&&store.current===owned){setSaved({key,snapshot:owned.value.getSnapshot()});setStorageBusy(false);}});return()=>{owned.value.dispose();if(store.current===owned)store.current=null;storageFlight.current=null;};},[key,port]);
 function current(){try{return alive.current&&!revoked.current&&latest.current===lease&&!disabled&&!storageBusy&&!storageFlight.current&&permitted()===true;}catch{return false;}}
 function photoChange(present:boolean){if(!current())return;latest.current=null;setSelected(present);setCells(blank());setConfirmed(false);setSelectionId(++selectionSequence.current);setNotice('');onInvalidate();}
 function field(name:keyof ManualCardCells,value:string){if(!current())return;latest.current=null;setCells({...cells,[name]:value});setConfirmed(false);setNotice('');onInvalidate();}
 function apply(){if(!current()||!selected||!confirmed||!draft)return;latest.current=null;setConfirmed(false);setNotice('Copied into the paper entry below. Check it and confirm the independent-entry statement before saving.');onApply(draft.winnerSide,draft.margin);}
 function restore(){if(!current()||!selected||store.current?.key!==key)return;const value=store.current.value.restore();if(!value)return;latest.current=null;setCells(value);setConfirmed(false);setRemoveConfirmed(false);setNotice('Restored text only. Compare this photo and confirm the row again. Nothing was copied or submitted.');onInvalidate();}
 async function storageAction(action:'load'|'save'|'remove'){
  if(!current()||store.current?.key!==key||(action==='save'&&!selected)||(action==='remove'&&!removeConfirmed))return;
  const owned=store.current,token={owned},value=structuredClone(cells);latest.current=null;storageFlight.current=token;setStorageBusy(true);setConfirmed(false);setRemoveConfirmed(false);onInvalidate();
  try{if(action==='load')await owned.value.load();else if(action==='save')await owned.value.save(value);else await owned.value.remove();if(alive.current&&!revoked.current&&store.current===owned&&storageFlight.current===token)setSaved({key,snapshot:owned.value.getSnapshot()});}
  finally{if(storageFlight.current===token){storageFlight.current=null;if(alive.current)setStorageBusy(false);}}
 }
 const snapshot=saved?.key===key?saved.snapshot:null,available=snapshot?.status==='available',canSave=selected&&Object.values(cells).some(Boolean)&&['available','empty'].includes(snapshot?.status??'');
 const blocked=disabled||storageBusy;
 return <div ref={region} hidden={hidden} className="local-paper-card-draft">
  <div className="local-photo-candidate-review"><LocalPaperCardPhoto inputId={inputId} label={label} disabled={blocked} permitted={permitted} subscribeRevocation={subscribeRevocation} onSelectionChange={photoChange}/>
  {selected&&selectionId>0&&ocrReview?.enabled===true&&isPaperPhotoTextScopeV1(ocrReview.scope)&&ocrReview.scope.side===target.side&&ocrReview.scope.gameNumber===target.gameNumber&&ocrReview.scope.fixedTournamentId===target.fixedTournamentId&&ocrReview.scope.opponentFixedTournamentId===target.opponentFixedTournamentId&&<SyntheticOcrCandidateReviewV1 enabled inputId={inputId} binding={{scope:ocrReview.scope,selectionId}} disabled={blocked} permitted={permitted} subscribeRevocation={subscribeRevocation} onInvalidate={()=>{if(current()){latest.current=null;setConfirmed(false);setCells({...cells});setNotice('');onInvalidate();}}} onAccept={value=>{if(current()&&selected){latest.current=null;setCells(value);setConfirmed(false);setNotice('Human-corrected synthetic candidate copied as text only. Compare the photo and confirm the manual draft again.');onInvalidate();return true;}return false;}}/>}
  </div>
  {retention&&<fieldset disabled={blocked}><legend>Text Draft on This Device</legend><p role="status">{snapshot?.message??'Checking saved text draft.'}</p><p>Only typed cells are saved here when you select Save Text Draft. Photos and confirmation are never saved. A restore needs this card&apos;s photo again.</p><button type="button" onClick={()=>{void storageAction('load');}}>Check Saved Text Draft</button><button type="button" disabled={!canSave} onClick={()=>{void storageAction('save');}}>Save Text Draft</button><button type="button" disabled={!selected||!available} onClick={restore}>Restore Saved Text</button>{available&&<><label className="draft-confirmation"><input type="checkbox" checked={removeConfirmed} onChange={e=>{if(current()){latest.current=null;setRemoveConfirmed(e.target.checked);}}}/><span>Remove this active saved text draft. Archived text remains on this device.</span></label><button type="button" disabled={!removeConfirmed} onClick={()=>{void storageAction('remove');}}>Remove Active Saved Text</button></>}</fieldset>}
  {selected&&<fieldset disabled={blocked}><legend>Transcribe Game {target.gameNumber} from This Photo</legend><p>Read this card yourself. Nothing is read automatically. Card: {target.fixedTournamentId}; opponent: {target.opponentFixedTournamentId}.</p>
   <label htmlFor={`${inputId}-gp`}>Game Points</label><select id={`${inputId}-gp`} value={cells.gamePoints} onChange={e=>field('gamePoints',e.target.value)}><option value="">Choose the Written Value</option><option value="0">0</option><option value="2">2</option><option value="3">3</option></select>
   {(['plusPoints','minusPoints']as const).map((name,index)=><span key={name}><label htmlFor={`${inputId}-${name}`}>{index===0?'Plus Spread':'Minus Spread'}</label><input id={`${inputId}-${name}`} inputMode="numeric" maxLength={3} autoComplete="off" value={cells[name]} onChange={e=>field(name,e.target.value.replace(/\D/g,'').slice(0,3))}/></span>)}
   <p>Leave the unused spread column blank. Both the written game points and spread must agree.</p>
   {draft?<p role="status">Draft: {draft.winnerSide===target.side?'This Card’s Player Wins':'This Card’s Opponent Wins'} by {draft.margin}. Game points on this card: {draft.gamePoints}. Not saved or verified.</p>:<p>Enter a complete, consistent row before using the draft.</p>}
   <label className="draft-confirmation"><input type="checkbox" checked={confirmed} disabled={!draft||disabled} onChange={e=>{if(current()){latest.current=null;setConfirmed(e.target.checked);}}}/><span>I compared this photo’s player ID, opponent ID, game number and row values with the details shown above.</span></label>
   <button type="button" disabled={disabled||!draft||!confirmed} onClick={apply}>Use Reviewed Draft</button>
  </fieldset>}{notice&&<p role="status">{notice}</p>}
 </div>;
}
