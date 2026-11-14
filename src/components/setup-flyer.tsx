'use client';
import{useId,useState}from'react';
import type{SetupFlyer as Flyer}from'../lib/setup-flyer';
import styles from'./setup-flyer.module.css';
const money=(c:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export function SetupFlyer({flyer}:{flyer:Flyer}){return <FlyerView key={JSON.stringify(flyer)} flyer={flyer}/>;}
function FlyerView({flyer:f}:{flyer:Flyer}){
 const[reviewed,setReviewed]=useState(false),id=useId();
 return <main className={styles.flyer}><div className={styles.controls}><label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I checked this saved version’s venue, public contact, event times, fees and notes. Missing payout details still need separate review.</label><button type="button" disabled={!reviewed} onClick={()=>{if(reviewed)window.print();}}>Print or Save Draft as PDF</button><p>This opens your browser’s print dialog. It does not publish the flyer or change setup.</p></div>
 <header><p className={styles.stamp}>DIRECTOR REVIEW DRAFT · SAVED SETUP VERSION {f.version}</p><h1>{f.name}</h1><p>{f.dates} · {f.timezone}</p><address>{f.venue.map((line,i)=><div key={i}>{line}</div>)}</address></header>
 <aside aria-label="Draft Review Notes" className={styles.notice}>{f.warnings.map((w,i)=><p key={i}>{w}</p>)}</aside>
 {(['primary','satellite','custom']as const).map(kind=>{const events=f.events.filter(e=>kind==='primary'?(e.kind==='main'||e.kind==='consolation'):e.kind===kind);return events.length?<section key={kind} aria-labelledby={`${id}-${kind}`}><h2 id={`${id}-${kind}`}>{kind==='primary'?'Main and Consolation Events':kind==='satellite'?'Satellite Events':'Additional Events'}</h2>{events.map((e,i)=><article key={i}><h3>{e.name}</h3><p>{e.kind==='consolation'?'Consolation (Consy)':e.kind==='main'?'Main Event':e.kind==='satellite'?'Satellite Event':'Custom Event'}</p><p><strong>{e.when}</strong></p><p>{e.style} · {e.format} · {e.games} Games</p><p><strong>Entry Fee: {money(e.feeCents)}</strong></p>{e.feeIncludes&&<p>Fee Includes: {e.feeIncludes}</p>}<p>Muggins: {e.muggins}</p>{e.qualification&&<p>Qualifying Details: {e.qualification}</p>}{e.eligibility&&<p>Eligibility: {e.eligibility}</p>}{e.payout&&<p>Payout Information: {e.payout}</p>}
 {e.savedPolicyDetails&&e.savedPolicyDetails.length>0&&<><h4>Saved Playoff / Payout Settings</h4><ul>{e.savedPolicyDetails.map((text,j)=><li key={j}>{text}</li>)}</ul></>}
 {e.qPools.length>0&&<><h4>Optional Q-Pools</h4><ul>{e.qPools.map((p,j)=><li key={j}>{p.name} — {money(p.feeCents)}{p.note?`; ${p.note}`:''}{p.savedMethod?` — Payout: ${p.savedMethod}`:''}</li>)}</ul></>}{e.sidePools.length>0&&<><h4>Optional Side Pools</h4><ul>{e.sidePools.map((p,j)=><li key={j}>{p.name} — {money(p.feeCents)}{p.note?`; ${p.note}`:''}{p.savedMethod?` — Payout: ${p.savedMethod}`:''}</li>)}</ul></>}
 </article>)}</section>:null;})}
 {(f.contact.name||f.contact.phone||f.contact.email||f.contact.mailingAddress)&&<section><h2>Tournament Director Contact</h2>{f.contact.name&&<p>{f.contact.name}</p>}{f.contact.phone&&<p>Phone: {f.contact.phone}</p>}{f.contact.email&&<p>Email: {f.contact.email}</p>}{f.contact.mailingAddress&&<p>Mailing Address for Correspondence: {f.contact.mailingAddress}</p>}</section>}
 <footer>Saved Setup Version {f.version} · Director Review Draft · Proposed payouts are not disbursements.</footer></main>;
}
