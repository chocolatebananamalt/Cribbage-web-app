import {createClient} from '../../../../../../../lib/supabase/server';
import {createSatelliteFinanceHandlersV1} from '../../../../../../../lib/api/satellite-finance-handlers-v1';
export const dynamic='force-dynamic';
const handlers=createSatelliteFinanceHandlersV1({client:createClient});
export const GET=handlers.GET;
export const POST=handlers.POST;
