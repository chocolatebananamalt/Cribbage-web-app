import{isNativeMixedPaperEntryBindingV1,projectNativeMixedPaperEntryV1}from'./native-mixed-paper-entry-view-v1.ts';
/** Display capabilities supplied by the server page, not role or write authority. */
export type PaperNavigationCapabilitiesV1={directoryEnabled?:boolean;correctionEnabled?:boolean};
export function paperEntryNavigationV1(binding:unknown,state:unknown,safety:{online:boolean;busy:boolean;initialized:boolean;blocked:boolean;pending:boolean;dirty:boolean},capabilities:PaperNavigationCapabilitiesV1={}){
 if(!isNativeMixedPaperEntryBindingV1(binding)||!safety.online||safety.busy||!safety.initialized||safety.blocked||safety.pending||safety.dirty)return null;
 const view=projectNativeMixedPaperEntryV1(binding,state);if(!view||view.phase==='capture'||view.phase==='review')return null;
 const t=binding.target,base=`/tournament/${t.tournamentId}`;
 return{
  directory:capabilities.directoryEnabled===true?`${base}/rehearsal-paper/${t.eventId}/${t.startId}`:null,
  correction:capabilities.correctionEnabled===true&&view.phase==='mismatch'&&binding.official.roles.includes('director')?`${base}/rehearsal-corrections/${t.eventId}/${t.startId}/${t.gameId}`:null,
 };
}
