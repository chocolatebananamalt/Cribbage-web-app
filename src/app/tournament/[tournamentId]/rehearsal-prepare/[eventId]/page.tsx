import{notFound}from'next/navigation';
import Link from'next/link';
import{nativeMixedPreparationPageEnabledV1}from'../../../../../lib/seating/native-mixed-pilot-preparation-v1';
import{NativeMixedPreparationProviderV1}from'../../../../../components/native-mixed-preparation-provider-v1';
import{nativeMixedMainFinanceRouteEnabledV1,nativeMixedPoolDirectorRouteEnabledV1}from'../../../../../lib/finance/native-mixed-finance-route-gates-v1';
import{nativeMixedPoolPlayerRouteEnabledV1}from'../../../../../lib/finance/native-mixed-pool-player-route-v1';
import{nativeMixedPlayoffOwnRouteEnabledV1}from'../../../../../lib/playoffs/native-mixed-playoff-own-route-v1';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 if(!nativeMixedPreparationPageEnabledV1())notFound();
 const{tournamentId,eventId}=await params;
 if(![tournamentId,eventId].every(v=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v)))notFound();
 const links=[
  {enabled:nativeMixedPoolDirectorRouteEnabledV1(),suffix:'pool-policies',label:'Director Pool Preparation'},
  {enabled:nativeMixedPoolPlayerRouteEnabledV1(),suffix:'pools',label:'My Pool Choices'},
  {enabled:nativeMixedPlayoffOwnRouteEnabledV1(),suffix:'playoffs',label:'My Playoff Matches'},
  {enabled:nativeMixedMainFinanceRouteEnabledV1(),suffix:'finance',label:'Main Finance'},
 ].filter(link=>link.enabled);
 return <>{links.length>0&&<nav aria-label="Rehearsal Sections"><ul>{links.map(link=><li key={link.suffix}><Link href={`/tournament/${tournamentId}/rehearsal/${eventId}/${link.suffix}`}>{link.label}</Link></li>)}</ul></nav>}<NativeMixedPreparationProviderV1 enabled tournamentId={tournamentId} eventId={eventId}/></>;
}
