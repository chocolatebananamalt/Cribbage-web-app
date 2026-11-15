import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {getCurrentSubject} from "../../lib/auth/current-subject";
import {getAccessibleTournaments} from "../../lib/tournaments/accessible-tournaments";
import {getDirectorAccessWorkspace} from "../../lib/director-administration";
import {DirectorAccessActions} from "../../components/director-access-actions";
import {SharedDeviceSignOut} from "../../components/shared-device-sign-out";
import {integratedAreas} from "../../lib/integrated-workspace";
import {integratedTestUiEnabled} from "../../lib/integrated-test-target";
export const dynamic="force-dynamic";
export default async function TestWorkspace(){
  if(!integratedTestUiEnabled())notFound();const subject=await getCurrentSubject();if(!subject)redirect('/sign-in?next=/test-workspace');
  const[access,director]=await Promise.all([getAccessibleTournaments(subject),getDirectorAccessWorkspace(subject)]);
  return <main className="auth-shell"><section className="auth-card wide-card"><p className="eyebrow">FICTIONAL TEST APP</p><h1>Your integrated tournament app</h1><p>Create your own tournament in the normal app, then open it from any signed-in test device. Use a different fictional person on the second device.</p>{director?<DirectorAccessActions access={director}/>:<p role="status">Director access is unavailable. The isolated test account needs its normal director authorization.</p>}<h2>Your tournaments</h2>{access.status==='available'?access.tournaments.length?<ul>{access.tournaments.map(t=><li key={t.tournamentId}><Link href={`/tournament/${t.tournamentId}`}>{t.tournamentName}</Link></li>)}</ul>:<p>No tournament has been created. Use Create Tournament when you are ready.</p>:<p role="status">Tournament access is temporarily unavailable. No example tournament is substituted.</p>}<h2>The 15 connected areas</h2><ol>{integratedAreas.map(a=><li key={a.id}><strong>{a.title}</strong><p>{a.summary}</p></li>)}</ol><SharedDeviceSignOut/></section></main>;
}
