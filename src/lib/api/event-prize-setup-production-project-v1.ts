import 'server-only';

export const eventPrizeSetupProductionProjectUrlV1='https://fnjkwymxpnsqvxtpronk.supabase.co';
/** Setup admission only. Never enables play, Finance, payouts or participant access. */
export function eventPrizeSetupProductionProjectEnabledV1(env:Record<string,string|undefined>=process.env):boolean{
 try{return env.EVENT_PRIZE_SETUP_PRODUCTION_ENABLED_V1==='true'
  &&env.NEXT_PUBLIC_SUPABASE_URL===eventPrizeSetupProductionProjectUrlV1;}catch{return false;}
}
