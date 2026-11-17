import{NextResponse}from'next/server';
import{privateNoStore,withApiFailureBoundary}from'../../../../../../../lib/api/route-boundary';
import{identityWorkflowRouteV5}from'../../../../../../../lib/identity-v5/runtime';
export const dynamic='force-dynamic';
async function run(request:Request,{params}:{params:Promise<{id:string;action:string}>}){return withApiFailureBoundary(async()=>{const{id,action}=await params;const response=await identityWorkflowRouteV5(request,id,action);const headers=new Headers(response.headers);for(const[k,v]of Object.entries(privateNoStore))headers.set(k,v);return new NextResponse(response.body,{status:response.status,statusText:response.statusText,headers})})}
export const GET=run;export const POST=run;
