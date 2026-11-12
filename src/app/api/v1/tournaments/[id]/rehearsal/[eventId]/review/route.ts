import {createNativeMixedReviewHandlersV1} from '../../../../../../../../lib/api/native-mixed-review-handlers-v1';
import {createClient} from '../../../../../../../../lib/supabase/server';
import {apiJson,withApiFailureBoundary} from '../../../../../../../../lib/api/route-boundary';
export const dynamic='force-dynamic';
const handlers=createNativeMixedReviewHandlersV1({projectRef:'nnhcnvksxgxnpvdqjgpg',projectUrl:process.env.NEXT_PUBLIC_SUPABASE_URL??'',client:createClient,json:apiJson,boundary:withApiFailureBoundary});
export const GET=handlers.GET;
