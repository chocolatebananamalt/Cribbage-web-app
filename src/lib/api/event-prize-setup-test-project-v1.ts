import 'server-only';

export const eventPrizeSetupTestProjectUrlV1='https://nnhcnvksxgxnpvdqjgpg.supabase.co';
/** Explicit stage-one test-project admission only. Current cookie identity,
 * Director/co-Director roles and every SQL guard remain independently required.
 * This admits all authorized test-project Directors, not a native cohort or
 * particular actor/event. It grants no Finance, payout or native-route access.
 * No NEXT_PUBLIC flag: only the server decides the Setup page mode and routes. */
export function eventPrizeSetupTestProjectEnabledV1(env:Record<string,string|undefined>=process.env):boolean{
 try{return env.EVENT_PRIZE_SETUP_TEST_PROJECT_ENABLED_V1==='true'
  &&env.NEXT_PUBLIC_SUPABASE_URL===eventPrizeSetupTestProjectUrlV1;}catch{return false;}
}
