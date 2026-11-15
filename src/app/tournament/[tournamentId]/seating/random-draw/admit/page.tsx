import Link from "next/link";
import { notFound } from "next/navigation";
import { fictionalDrawBoundaryEnabled } from "../../../../../../lib/api/fictional-draw-enabled";
import { isUuid } from "../../../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { getEventScheduleWorkspace } from "../../../../../../lib/events/schedule-workspace";
import { RecoveryDocumentBoundary } from "../../../../../../components/recovery-document-boundary";
import FictionalDrawAction from "../../../../../../components/fictional-draw-action";
export default async function Page({params}:{params:Promise<{tournamentId:string}>}) {
 if(!fictionalDrawBoundaryEnabled())notFound();
 const {tournamentId}=await params;if(!isUuid(tournamentId)||tournamentId!==tournamentId.toLowerCase())notFound();
 const access=await requireTournamentAccess(tournamentId);if(!access.roles.some(r=>r==="director"||r==="co_director"))notFound();
 const workspace=await getEventScheduleWorkspace(access.user.id,tournamentId);
 if(workspace.events.length!==1) return <main className="auth-shell"><section className="auth-card"><h1>Reviewed draw unavailable</h1><p>Activate one 12-game Standard Singles Main event first.</p><Link href={`/tournament/${tournamentId}`}>Back to tournament</Link></section></main>;
 return <RecoveryDocumentBoundary actorId={access.user.id}><main className="auth-shell"><section className="auth-card"><h1>Fictional tournament reviewed draw</h1><FictionalDrawAction actorId={access.user.id} tournamentId={tournamentId} eventId={workspace.events[0].eventId}/><p><Link href={`/tournament/${tournamentId}/seating/random-draw`}>Continue to saved draw</Link></p><Link href={`/tournament/${tournamentId}/seating`}>Back to seating</Link></section></main></RecoveryDocumentBoundary>;
}
