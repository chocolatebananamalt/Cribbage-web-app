'use client';
import{useId,useState}from'react';
import{filterSetupDefinitions}from'../lib/setup-definitions';
import styles from'./setup-definitions.module.css';
export function SetupDefinitions(){
 const[query,setQuery]=useState(''),id=useId(),items=filterSetupDefinitions(query),categories=[...new Set(items.map(d=>d.category))];
 return <main className={styles.page}><h1>Tournament Setup Definitions</h1><p>Use this reference while setting up events. It explains the app’s terms; the event’s reviewed rules and saved payout settings govern its operation.</p><label htmlFor={id}>Find a Term</label><input id={id} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="For example: Q-Pool, Tournament ID, or prize fund"/><p role="status" aria-live="polite">{items.length} {items.length===1?'definition':'definitions'} found.</p>{query&&<button type="button" onClick={()=>setQuery('')}>Show All Definitions</button>}
 {!items.length&&<p>No matching term. Try a shorter word or show all definitions.</p>}
 {categories.map((category,index)=><section key={category} aria-labelledby={`${id}-${index}`}><h2 id={`${id}-${index}`}>{category}</h2><dl>{items.filter(d=>d.category===category).map(d=><div key={d.term}><dt>{d.term}</dt><dd>{d.meaning}</dd></div>)}</dl></section>)}
 <p>This reference does not save or change tournament data. Keep your setup tab open while consulting it.</p></main>;
}
