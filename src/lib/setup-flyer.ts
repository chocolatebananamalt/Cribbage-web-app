import{isSetupWorkspace}from'./api/setup.ts';
export type SetupFlyer={version:number;name:string;dates:string;timezone:string;venue:string[];contact:{name:string;phone:string;email:string;mailingAddress:string};events:{kind:'main'|'consolation'|'satellite'|'custom';savedPolicyDetails?:string[];name:string;when:string;style:string;format:string;games:number;feeCents:number;feeIncludes:string;payout:string;qualification:string;eligibility:string;muggins:string;qPools:{name:string;feeCents:number;note:string;savedMethod?:string}[];sidePools:{name:string;feeCents:number;note:string;savedMethod?:string}[]}[];warnings:string[]};
function local(value:string,withTime=false){const m=/^(\d{4})-(\d{2})-(\d{2})T([0-2]\d):([0-5]\d)(?::[0-5]\d(?:\.\d{1,6})?)?$/.exec(value);if(!m||Number(m[4])>23)return null;const d=new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==value.slice(0,10))return null;return`${m[2]}-${m[3]}-${m[1]}${withTime?` ${m[4]}:${m[5]}`:''}`;}
const zone=(s:string)=>{try{new Intl.DateTimeFormat('en-US',{timeZone:s});return true;}catch{return false;}};
/** Deliberate allow-list: no account, roster, internal official IDs, sanctioning
 * overrides, financial totals or retired free-text contact are projected. */
export function buildSetupFlyer(value:unknown):SetupFlyer|null{
 if(!isSetupWorkspace(value)||!value.current)return null;const c=value.current,start=local(c.startsAt),end=local(c.endsAt);if(!start||!end||c.endsAt.slice(0,10)<c.startsAt.slice(0,10)||!zone(c.timezone))return null;
 const warnings=['Director review draft. Unsaved setup edits are not included.','Playoff series/prize settings and separately versioned Custom pool methods are not included by this setup reader. Review them separately before distribution.'];
 const name=[c.tournamentDirectorFirstName.trim(),c.tournamentDirectorLastName.trim()].filter(Boolean).join(' ');
 if(!c.tournamentDirectorFirstName.trim()||!c.tournamentDirectorLastName.trim())warnings.push('Structured Director name is incomplete. Review the saved public contact details.');
 if(!c.venueName.trim()||!c.venueStreet.trim())warnings.push('Structured venue details are incomplete. Review the saved address.');
 const events:SetupFlyer['events']=[];
 for(const e of c.events){const when=local(e.startsAt,true);if(!when||!zone(e.timezone))return null;
  events.push({kind:e.eventKind,name:e.displayName,when:`${when} ${e.timezone}`,style:e.styleCode,format:({standard_singles:'Standard Singles',team:'Team',doubles:'Traditional Doubles',canadian_doubles:'Canadian Doubles',custom:'Custom'})[e.formatCode],games:e.gameCount,feeCents:e.entryFeeCents,feeIncludes:e.feeIncludesNote,payout:e.payoutNote,qualification:e.qualificationNote,eligibility:e.eligibilityNote,muggins:e.mugginsStatus==='in_effect'?'In Effect':e.mugginsStatus==='not_in_effect'?'Not in Effect':'Not Specified — Director Review Required',qPools:e.qPools.map(p=>({name:p.poolTypeCode,feeCents:p.entryFeeCents,note:p.note})),sidePools:e.sidePools.map(p=>({name:p.poolTypeCode,feeCents:p.entryFeeCents,note:p.note}))});
 }
 if(!events.length)warnings.push('No events have been saved.');
 return{version:c.version,name:c.tournamentName,dates:start===end?start:`${start} through ${end}`,timezone:c.timezone,venue:[c.venueName,c.venueStreet,[c.city,c.stateTerritory,c.venuePostalCode].filter(Boolean).join(', ')].filter(Boolean),contact:{name,phone:c.tournamentContactPhone,email:c.tournamentContactEmail,mailingAddress:c.tournamentMailingAddress},events,warnings};
}
