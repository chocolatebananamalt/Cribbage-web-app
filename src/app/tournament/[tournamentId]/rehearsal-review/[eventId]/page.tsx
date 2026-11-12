import {notFound} from 'next/navigation';
import {nativeMixedReviewUiEnabledV1} from '../../../../../lib/finance/native-mixed-review-read-v1';
import {NativeMixedReviewProviderV1} from '../../../../../components/native-mixed-review-provider-v1';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{tournamentId:string;eventId:string}>}){
 if(!nativeMixedReviewUiEnabledV1())notFound();const {tournamentId,eventId}=await params;
 if(![tournamentId,eventId].every(v=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v)))notFound();
 return <NativeMixedReviewProviderV1 enabled tournamentId={tournamentId} eventId={eventId}/>;
}
