import type { SetupEvent } from './api/setup.ts';
import type { SetupEventLinkChoice } from './api/setup-event-links.ts';
const key=(id:string)=>id.toLowerCase();
/** Never remove a Main while its linked or possibly dependent events remain. */
export function mainRemovalBlocked(mainId: string, events: SetupEvent[], choices: SetupEventLinkChoice[]): boolean {
 const mains=events.filter(event=>event.eventKind==='main');
 if(choices.some(choice=>key(choice.mainClientRowId)===key(mainId)&&choice.consolationClientRowIds.length>0))return true;
 const mainIds=new Set(mains.map(main=>key(main.clientRowId)));
 const assigned=new Set(choices.filter(choice=>mainIds.has(key(choice.mainClientRowId))).flatMap(choice=>choice.consolationClientRowIds.map(key)));
 if(events.some(event=>event.eventKind==='consolation'&&!assigned.has(key(event.clientRowId))))return true;
 return mains.length<=1&&events.some(event=>key(event.clientRowId)!==key(mainId)&&event.eventKind!=='main');
}
/** Order only a new linked draft save; retained requests and saved revisions stay unchanged. */
export function canonicalGuidedEvents(events: SetupEvent[], choices: SetupEventLinkChoice[]): SetupEvent[] {
 const mains=events.filter(event=>event.eventKind==='main'),consolations=events.filter(event=>event.eventKind==='consolation');
 const emitted=new Set<SetupEvent>();
 const grouped=mains.flatMap(main=>{const ids=new Set((choices.find(choice=>key(choice.mainClientRowId)===key(main.clientRowId))?.consolationClientRowIds??[]).map(key));const children=consolations.filter(event=>ids.has(key(event.clientRowId))&&!emitted.has(event));children.forEach(event=>emitted.add(event));return [main,...children];});
 return [...grouped,...consolations.filter(event=>!emitted.has(event)),...events.filter(event=>event.eventKind!=='main'&&event.eventKind!=='consolation')];
}


