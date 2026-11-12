import{notFound}from'next/navigation';
import{nativeMixedPreparationPageEnabledV1}from'../../../../../lib/seating/native-mixed-pilot-preparation-v1';
import{NativeMixedPreparationProviderV1}from'../../../../../components/native-mixed-preparation-provider-v1';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{tournamentId:string;eventId:string}>}){if(!nativeMixedPreparationPageEnabledV1())notFound();const{tournamentId,eventId}=await params;if(![tournamentId,eventId].every(v=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v)))notFound();return <NativeMixedPreparationProviderV1 enabled tournamentId={tournamentId} eventId={eventId}/>;}
