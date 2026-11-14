import {createMrpMembershipManualReviewHandlersV1} from "./../../../../../../../../lib/api/mrp-membership-manual-review-v1";
import {createClient} from "./../../../../../../../../lib/supabase/server";
const handlers=createMrpMembershipManualReviewHandlersV1({client:createClient});
export const GET=handlers.GET;
export const POST=handlers.POST;
