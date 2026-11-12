"use client";
import {useLayoutEffect,useRef} from "react";
import {formatUsPhoneInputEdit,reconcileUsPhoneSeparatorDeletion,usPhoneDeleteDirection,usPhoneSeparatorDeletion,type UsPhoneInputEdit,type UsPhonePriorSelection} from "../lib/us-phone-input";

type BeforeInputSelection=UsPhonePriorSelection&{value:string;inputType:string};

export function TournamentPhoneInput({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
 const inputRef=useRef<HTMLInputElement>(null),pendingSelection=useRef<UsPhoneInputEdit|null>(null),beforeInputSelection=useRef<BeforeInputSelection|null>(null),selectionToken=useRef(0);
 useLayoutEffect(()=>{
  const input=inputRef.current;if(!input)return;
  const remember=(event:Event)=>{const native=event as InputEvent,direction=usPhoneDeleteDirection(native.inputType);if(native.isComposing||!direction){beforeInputSelection.current=null;return;}beforeInputSelection.current={value:input.value,inputType:native.inputType,selectionStart:input.selectionStart??0,selectionEnd:input.selectionEnd??input.selectionStart??0};};
  input.addEventListener("beforeinput",remember);return()=>input.removeEventListener("beforeinput",remember);
 },[]);
 useLayoutEffect(()=>{
  beforeInputSelection.current=null;
  const selection=pendingSelection.current,input=inputRef.current;if(!selection||!input)return;
  if(disabled||selection.value!==value||input.value!==value){pendingSelection.current=null;return;}
  pendingSelection.current=null;if(document.activeElement===input)input.setSelectionRange(selection.selectionStart,selection.selectionEnd);
 },[value,disabled]);
 function clearPending(){selectionToken.current++;pendingSelection.current=null;beforeInputSelection.current=null;}
 function commit(edit:UsPhoneInputEdit){
  const token=++selectionToken.current;pendingSelection.current=edit;onChange(edit.value);
  queueMicrotask(()=>{const selection=pendingSelection.current,input=inputRef.current;if(token!==selectionToken.current||!selection||!input||input.value!==selection.value)return;pendingSelection.current=null;if(document.activeElement===input)input.setSelectionRange(selection.selectionStart,selection.selectionEnd);});
 }
 return <input ref={inputRef} type="tel" inputMode="tel" autoComplete="tel" maxLength={40} disabled={disabled} value={value}
  onSelect={event=>{const input=event.currentTarget;beforeInputSelection.current={value:input.value,inputType:"",selectionStart:input.selectionStart??0,selectionEnd:input.selectionEnd??input.selectionStart??0};}}
  onChange={event=>{const input=event.currentTarget,native=event.nativeEvent as InputEvent,before=beforeInputSelection.current;beforeInputSelection.current=null;if(native.isComposing){clearPending();onChange(input.value);return;}const inputType=native.inputType||before?.inputType||"",prior=before?.value===value&&(!before.inputType||before.inputType===inputType)?before:undefined,deletion=reconcileUsPhoneSeparatorDeletion(value,input.value,input.selectionStart,input.selectionEnd,inputType,prior);commit(deletion??formatUsPhoneInputEdit(input.value,input.selectionStart,input.selectionEnd));}}
  onCompositionStart={clearPending}
  onCompositionEnd={event=>{const input=event.currentTarget;commit(formatUsPhoneInputEdit(input.value,input.selectionStart,input.selectionEnd));}}
  onBlur={clearPending}
  onBeforeInput={event=>{const native=event.nativeEvent as InputEvent,direction=usPhoneDeleteDirection(native.inputType);if(native.isComposing||!direction)return;const input=event.currentTarget;if(input.selectionStart!==input.selectionEnd)return;const edit=usPhoneSeparatorDeletion(input.value,input.selectionStart,input.selectionEnd,direction);if(!edit)return;event.preventDefault();beforeInputSelection.current=null;commit(edit);}}
  onKeyDown={event=>{if(event.ctrlKey||event.metaKey||event.altKey||event.nativeEvent.isComposing||event.key!=="Backspace"&&event.key!=="Delete")return;const input=event.currentTarget,edit=usPhoneSeparatorDeletion(input.value,input.selectionStart,input.selectionEnd,event.key==="Backspace"?"backward":"forward");if(!edit)return;event.preventDefault();beforeInputSelection.current=null;commit(edit);}}/>;
}
