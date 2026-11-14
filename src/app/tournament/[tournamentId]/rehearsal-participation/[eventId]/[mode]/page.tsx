import{notFound}from'next/navigation';
import{NativeMixedBootstrapProviderV1}from'../../../../../../components/native-mixed-bootstrap-provider-v1';
import{bootstrapWorkflowEnabled}from'../../../../../../lib/seating/native-mixed-bootstrap-workflow-v1';
export const dynamic='force-dynamic';
export default async function ParticipationPage({params}:{params:Promise<{tournamentId:string;eventId:string;mode:string}>}){
 if(!bootstrapWorkflowEnabled())notFound();const{tournamentId,eventId,mode}=await params,uuid=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
 if(!uuid.test(tournamentId)||!uuid.test(eventId)||!['director','consent','paper-review'].includes(mode))notFound();
 return <main><h1>{mode==='director'?'Director Rehearsal Preparation':'Rehearsal Participation'}</h1><NativeMixedBootstrapProviderV1 enabled tournamentId={tournamentId} eventId={eventId} mode={mode as 'director'|'consent'|'paper-review'}/></main>;
}
