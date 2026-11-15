"use client";
import "./setup-side-pool-editor.css";
import{useEffect,useId,useLayoutEffect,useRef,useState}from'react';
import{customPayoutDraftIssue,presetPayoutFromCustomRatio,type SetupPayoutChoiceKind}from'../lib/api/setup-custom-payout-choice';
type Props={value:string;options:readonly string[];kind:SetupPayoutChoiceKind;onChange:(value:string)=>void;onValidityChange?:(valid:boolean)=>void;editorIdentity?:string;validationIdentity?:string;disabled?:boolean};
export function SetupPresetPayoutChoice(props:Props){return<ChoiceState key={props.editorIdentity??props.kind} {...props}/>;}
function ChoiceState({value,options,kind,onChange,onValidityChange,disabled=false,validationIdentity}:Props){
 const[custom,setCustom]=useState(false),[raw,setRaw]=useState('');const callback=useRef(onValidityChange),typeId=useId(),helpId=useId();
 useLayoutEffect(()=>{callback.current=onValidityChange;},[onValidityChange]);const issue=custom?customPayoutDraftIssue(kind,raw,options):null;
 useEffect(()=>{const notify=callback.current;notify?.(!issue);return()=>{notify?.(true);};},[issue,validationIdentity]);
 const savedUnknown=!options.includes(value)&&value!=='';
 return<><div className="setup-side-payout-heading"><label htmlFor={typeId}>{kind==='q'?'Pool Type':'Payout'}</label>{custom&&<label className="setup-side-ratio-line"><span>1-in-</span><input disabled={disabled} required aria-required="true" aria-label={`${kind==='q'?'Q-Pool':'Satellite'} payout ratio`} aria-describedby={helpId} aria-invalid={!!issue} inputMode="numeric" pattern="[0-9]+" value={raw} onChange={e=>{const next=e.target.value;setRaw(next);callback.current?.(!customPayoutDraftIssue(kind,next,options));onChange(presetPayoutFromCustomRatio(kind,next,options)??'');}}/><span aria-hidden="true" className="setup-side-ratio-required">*</span><span className="sr-only"> (required)</span></label>}</div>
 <select id={typeId} aria-label={kind==='q'?'Pool type':'Payout'} disabled={disabled} required={kind==='q'} value={custom?'custom':value} onChange={e=>{if(e.target.value==='custom'){setCustom(true);setRaw('');callback.current?.(false);onChange('');return;}setCustom(false);setRaw('');callback.current?.(true);onChange(e.target.value);}}><option value="">{kind==='q'?'Select a Q-Pool type':'Select a payout'}</option>{options.map(option=><option key={option} value={option}>{option}</option>)}{savedUnknown&&!custom&&<option value={value}>{value} (saved description)</option>}<option value="custom">{kind==='satellite'?'1-in-# (Custom)':'Graduated 1-in-# (Custom)'}</option></select>
 {custom&&<p id={helpId} className={issue?'error-text':'field-help'}>{issue??'This matches an existing setup choice. Calculation and accounting still depend on the separately reviewed event or pool policy.'}</p>}
 </>;
}
