import Link from "next/link";
import { integratedAreaLinks } from "../lib/integrated-workspace";
export function IntegratedWorkspaceNav({tournamentId,director,official}:{tournamentId:string;director:boolean;official:boolean}) {
  return <section aria-labelledby="integrated-areas-title"><h2 id="integrated-areas-title">Your test app workflow</h2><p>Fictional test environment. Use normal setup and transactions; no tournament has been created for you.</p><div className="workspace-phase-grid">{integratedAreaLinks(tournamentId,director,official).map(area=><section className="workspace-phase" key={area.id}><h3>{area.id}. {area.title}</h3><p>{area.summary}</p>{area.paths.map(p=><Link key={p.href+p.label} className="guide-link" href={p.href}>{p.label}</Link>)}{area.paths.length===0?<p>These tools are available to the tournament&apos;s assigned officials.</p>:null}</section>)}</div></section>;
}
