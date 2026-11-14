import 'server-only';
import{eventPrizeSetupTestProjectEnabledV1,eventPrizeSetupTestProjectUrlV1}from'./event-prize-setup-test-project-v1.ts';
import{eventPrizeSetupProductionProjectEnabledV1,eventPrizeSetupProductionProjectUrlV1}from'./event-prize-setup-production-project-v1.ts';
/** Keep the exact test gate independent; either project needs its own server flag. */
export function eventPrizeSetupAdmittedProjectUrlV1(env:Record<string,string|undefined>=process.env):string|null{
 if(eventPrizeSetupTestProjectEnabledV1(env))return eventPrizeSetupTestProjectUrlV1;
 if(eventPrizeSetupProductionProjectEnabledV1(env))return eventPrizeSetupProductionProjectUrlV1;
 return null;
}
export function eventPrizeSetupEnabledV1(env:Record<string,string|undefined>=process.env):boolean{return eventPrizeSetupAdmittedProjectUrlV1(env)!==null;}
export function requireEventPrizeSetupProjectUrlV1():string{
 const url=eventPrizeSetupAdmittedProjectUrlV1();if(url===null)throw new Error('Latest Setup project is unavailable.');return url;
}
