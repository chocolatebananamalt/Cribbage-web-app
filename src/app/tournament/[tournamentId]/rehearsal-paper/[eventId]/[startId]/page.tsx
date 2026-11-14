import{notFound}from'next/navigation';
import{nativeMixedPaperDirectoryEnabledV1,preparePaperDirectoryV1}from'../../../../../../lib/seating/native-mixed-paper-directory-route-v1';
import{createClient}from'../../../../../../lib/supabase/server';
import{getPublicSupabaseEnv}from'../../../../../../lib/env';
import{NativeMixedPaperDirectoryV1}from'../../../../../../components/native-mixed-paper-directory-v1';
export const dynamic='force-dynamic';
export default async function PaperDirectoryPage({params}:{params:Promise<{tournamentId:string;eventId:string;startId:string}>}){
 if(!nativeMixedPaperDirectoryEnabledV1())notFound();
 const directory=await preparePaperDirectoryV1({enabled:true,params:await params,projectUrl:getPublicSupabaseEnv().url,createAuthenticated:createClient});
 if(!directory)notFound();
 return <NativeMixedPaperDirectoryV1 enabled directory={directory}/>;
}
