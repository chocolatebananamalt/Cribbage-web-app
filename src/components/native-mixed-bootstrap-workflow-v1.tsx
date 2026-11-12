'use client';
import{useEffect,useRef,useState}from'react';
import Link from'next/link';
import{NativeMixedBootstrapSessionV1,type BootstrapSnapshot}from'../lib/seating/native-mixed-bootstrap-session-v1';
import type{BootstrapContext,BootstrapAction}from'../lib/seating/native-mixed-bootstrap-workflow-v1';
import styles from'./native-mixed-director-panel-v1.module.css';
const titles:Record<BootstrapAction,string>={intent:'Confirm Rehearsal Setup','fund-scope':'Prepare Simulated Entries','fund-entry':'Record Simulated Entry','attendance-scope':'Prepare Player Consent','paper-declaration':'Declare Fictional Paper Entries','paper-review':'Review Fictional Paper Entries','attendance-seal':'Seal Test Readiness','consent-grant':'Give My Test Consent','consent-revoke':'Withdraw My Test Consent'};
export function NativeMixedBootstrapScreenV1({enabled=false,context,controller,online}:{enabled?:boolean;context:BootstrapContext;controller:NativeMixedBootstrapSessionV1;online:boolean}){
 const[,render]=useState(0),[busy,setBusy]=useState(false),[ack,setAck]=useState<string|null>(null),alive=useRef(false),flight=useRef(false);
 useEffect(()=>{if(!enabled)return;alive.current=true;void controller.activate(context).then(async ok=>{if(ok&&alive.current)await controller.refresh();if(alive.current)render(v=>v+1);});const timer=setInterval(()=>{if(alive.current)render(v=>v+1);},1000);return()=>{alive.current=false;clearInterval(timer);void controller.activate(null);};},[enabled,context,controller]);
 const snapshot=controller.getSnapshot();async function run(work:()=>Promise<unknown>){if(flight.current)return;flight.current=true;setBusy(true);try{await work();}finally{flight.current=false;if(alive.current){setBusy(false);render(v=>v+1);}}}
 return <NativeMixedBootstrapViewV1 enabled={enabled} context={context} snapshot={snapshot} online={online} busy={busy} confirmed={!!snapshot.offer?.offerDigest&&snapshot.offer.offerDigest===ack} confirm={v=>setAck(v?snapshot.offer?.offerDigest??null:null)} refresh={()=>void run(()=>controller.refresh())} submit={()=>void run(()=>controller.submit(!!snapshot.offer?.offerDigest&&snapshot.offer.offerDigest===ack))} check={()=>void run(()=>controller.check())} retry={()=>void run(()=>controller.retryExact())}/>;
}
export function NativeMixedBootstrapViewV1({enabled,context,snapshot,online,busy,confirmed,confirm,refresh,submit,check,retry}:{enabled:boolean;context:BootstrapContext;snapshot:BootstrapSnapshot;online:boolean;busy:boolean;confirmed:boolean;confirm:(v:boolean)=>void;refresh:()=>void;submit:()=>void;check:()=>void;retry:()=>void}){
 if(!enabled)return null;const offer=snapshot.offer,action=offer?.state==='offered'?offer.action:null,waiting=['ready','recorded'].includes(snapshot.status);
 const statement=action==='consent-grant'?'I choose to join this test through my own digital account. This does not claim real attendance or payment.':action==='consent-revoke'?'I choose to withdraw my consent for this test.':action==='paper-declaration'?'I confirm these twelve paper entries are fictional. No real attendance or human play is claimed.':action==='paper-review'?'I independently reviewed these twelve fictional entries using my own authorized account.':'I confirm this test-only step. No actual money, attendance or official result is being recorded.';
 return <section className={styles.panel} aria-label="Test Participation Preparation"><h2>{context.mode==='director'?'Prepare Test Participation':context.mode==='consent'?'My Test Consent':'Independent Paper Roster Review'}</h2><p><strong>TEST ONLY</strong> — 18 entries: 6 Digital and 12 Fictional Paper.</p>
 {offer&&<><h3>{offer.tournamentName}</h3><p>{offer.eventName}</p></>}
 <p role="status" aria-live="polite">{snapshot.message}</p>
 {context.mode==='director'&&<p>This requires an approved test event, roster and officials. It does not create accounts, assign roles, or consent on behalf of players.</p>}
 {waiting&&<button type="button" disabled={busy||!online} onClick={refresh}>{snapshot.status==='recorded'?'Refresh Next Step':'Refresh Preparation'}</button>}
 {action&&offer&&<><h3>{titles[action]}</h3>{action==='fund-entry'&&<p>Simulated Entry {offer.completedEntries+1} of 18{offer.simulatedAmountMinor!==null?` · $${(offer.simulatedAmountMinor/100).toLocaleString('en-US',{maximumFractionDigits:2})}`:''}</p>}
 {offer.people.length>0&&<ul>{offer.people.map(person=><li key={person.rosterEntryId}>{person.displayName}</li>)}</ul>}
 <label className={styles.check}><input type="checkbox" checked={confirmed} disabled={busy||!online||!offer.writesAvailable} onChange={e=>confirm(e.target.checked)}/>{statement}</label><button type="button" disabled={busy||!online||!confirmed||!offer.writesAvailable} onClick={submit}>{titles[action]}</button>{!offer.writesAvailable&&<p>This test is read-only. Saved work is kept.</p>}</>}
 {snapshot.wire&&['pending','blocked'].includes(snapshot.status)&&<button type="button" disabled={busy||!online} onClick={check}>Check Saved Operation</button>}
 {snapshot.status==='pending'&&['not_sent','retryable'].includes(snapshot.phase??'')&&<button type="button" disabled={busy||!online} onClick={retry}>Retry Same Saved Operation</button>}
 {!online&&<p>Offline. Saved operations are kept; reconnect to check them.</p>}
 {context.mode==='director'&&<p>Each player must use their own <Link href={`/tournament/${context.scope.tournamentId}/rehearsal-participation/${context.scope.eventId}/consent`}>Test Consent screen</Link>. A different authorized cross-checker must use the <Link href={`/tournament/${context.scope.tournamentId}/rehearsal-participation/${context.scope.eventId}/paper-review`}>Independent Review screen</Link>.</p>}
 {context.mode!=='director'&&<p><Link href={`/tournament/${context.scope.tournamentId}`}>Back to Tournament</Link></p>}
 </section>;
}
