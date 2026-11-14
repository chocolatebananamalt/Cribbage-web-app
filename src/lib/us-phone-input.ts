export type UsPhoneInputEdit={value:string;selectionStart:number;selectionEnd:number};
export type UsPhoneDeleteDirection='backward'|'forward';
export type UsPhonePriorSelection={selectionStart:number;selectionEnd:number};

const decorations=/^[\d\s().-]*$/;
const digits=(value:string)=>value.replace(/\D/g,'');
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

function domesticDigits(value:string){
 if(value==='')return'';
 if(!decorations.test(value))return null;
 const valueDigits=digits(value);if(valueDigits.length===0)return null;
 if(valueDigits.length<=10)return valueDigits;
 return valueDigits.length===11&&valueDigits.startsWith('1')?valueDigits:null;
}

function group(valueDigits:string){
 const country=valueDigits.length===11?'1-':'',local=country?valueDigits.slice(1):valueDigits;
 if(local.length<=3)return country+local;
 if(local.length<=6)return `${country}${local.slice(0,3)}-${local.slice(3)}`;
 return `${country}${local.slice(0,3)}-${local.slice(3,6)}-${local.slice(6)}`;
}

/** Formats only an unambiguous domestic edit. International, extension,
 * unknown, and overlong text is returned byte-for-byte. */
export function formatUsPhoneInput(value:string){
 const valueDigits=domesticDigits(value);return valueDigits===null?value:group(valueDigits);
}

function mappedSelection(value:string,position:number,formatted:string){
 const safe=clamp(position,0,value.length),count=digits(value.slice(0,safe)).length;
 if(count===0)return 0;
 let seen=0,mapped=formatted.length;
 for(let index=0;index<formatted.length;index++)if(/\d/.test(formatted[index])){seen++;if(seen===count){mapped=index+1;break;}}
 if(safe>0&&!/\d/.test(value[safe-1]??''))while(mapped<formatted.length&&!/\d/.test(formatted[mapped]))mapped++;
 return mapped;
}

/** Maps a browser edit's selection by digit position so inserted separators do
 * not throw the caret to the end during middle edits or paste. */
export function formatUsPhoneInputEdit(value:string,selectionStart:number|null,selectionEnd:number|null):UsPhoneInputEdit{
 const start=clamp(selectionStart??value.length,0,value.length),end=clamp(selectionEnd??start,start,value.length);
 const formatted=formatUsPhoneInput(value);
 if(formatted===value)return{value,selectionStart:start,selectionEnd:end};
 return{value:formatted,selectionStart:mappedSelection(value,start,formatted),selectionEnd:mappedSelection(value,end,formatted)};
}

export function usPhoneDeleteDirection(inputType:string):UsPhoneDeleteDirection|null{
 if(inputType==='deleteContentBackward')return'backward';
 if(inputType==='deleteContentForward')return'forward';
 return null;
}

/** Reconciles the mobile/input-event case where the browser already removed
 * exactly one formatter hyphen without dispatching a keydown/beforeinput event. */
export function reconcileUsPhoneSeparatorDeletion(previousValue:string,nextValue:string,selectionStart:number|null,selectionEnd:number|null,inputType:string,priorSelection?:UsPhonePriorSelection):UsPhoneInputEdit|null{
 const direction=usPhoneDeleteDirection(inputType),start=selectionStart??-1,end=selectionEnd??-1;
 if(!direction||start!==end||domesticDigits(previousValue)===null)return null;
 const removed=[] as number[];
 for(let index=0;index<previousValue.length;index++)if(previousValue[index]==='-'&&previousValue.slice(0,index)+previousValue.slice(index+1)===nextValue)removed.push(index);
 if(removed.length!==1||start!==removed[0])return null;
 if(!priorSelection)return formatUsPhoneInputEdit(nextValue,start,end);
 const priorStart=clamp(priorSelection.selectionStart,0,previousValue.length),priorEnd=clamp(priorSelection.selectionEnd,priorStart,previousValue.length);
 if(priorStart!==priorEnd)return priorStart===removed[0]&&priorEnd===removed[0]+1?formatUsPhoneInputEdit(nextValue,start,end):null;
 const expected=direction==='backward'?removed[0]+1:removed[0];if(priorStart!==expected)return null;
 const caret=direction==='backward'?removed[0]+1:removed[0];
 return usPhoneSeparatorDeletion(previousValue,caret,caret,direction);
}

/** Returns a replacement only when Backspace/Delete targets an inserted
 * hyphen. The adjacent digit is removed so the formatter cannot simply
 * reinsert the separator and make the key appear broken. */
export function usPhoneSeparatorDeletion(value:string,selectionStart:number|null,selectionEnd:number|null,direction:UsPhoneDeleteDirection):UsPhoneInputEdit|null{
 const start=clamp(selectionStart??0,0,value.length),end=clamp(selectionEnd??start,start,value.length);
 if(start!==end||domesticDigits(value)===null)return null;
 const separator=direction==='backward'?start-1:start;
 if(separator<0||separator>=value.length||value[separator]!=='-')return null;
 let target=separator+(direction==='backward'?-1:1);
 while(target>=0&&target<value.length&&!/\d/.test(value[target]))target+=direction==='backward'?-1:1;
 if(target<0||target>=value.length)return null;
 const raw=value.slice(0,target)+value.slice(target+1),caret=direction==='backward'?target:start;
 return formatUsPhoneInputEdit(raw,caret,caret);
}
