import 'server-only';
import {createCloseoutCapabilityVerifierV19,type CapabilityPinsV19} from './closeout-capability-v19.ts';
import {assertIntegratedTestTarget} from '../integrated-test-target.ts';

// No existing test flag implies this capability. Production is never accepted.
// These pins are reviewed nonsecret deployment inputs, not credentials. Merely
// providing them does not enable the route or UI's still-closed V18 gates.
export function closeoutRuntimePinsV20(env:Record<string,string|undefined>=process.env):CapabilityPinsV19|null{
 try{const target=assertIntegratedTestTarget(env);if(target.local||target.projectRef!=='nnhcnvksxgxnpvdqjgpg')return null;}catch{return null;}
 if(env.CRIBBAGE_CLOSEOUT_CAPABILITY_V20!=='reviewed-fictional-backend'||env.CRIBBAGE_TEST_ISOLATION_CONFIRMED!=='verified-fictional-backend')return null;
 if(env.NEXT_PUBLIC_SUPABASE_URL!=='https://nnhcnvksxgxnpvdqjgpg.supabase.co'||env.CRIBBAGE_TEST_APP_BRANCH!=='codex/integrated-test-app')return null;
 const catalogHash=env.CRIBBAGE_CLOSEOUT_CATALOG_SHA256_V20,admissionSetHash=env.CRIBBAGE_CLOSEOUT_ADMISSION_SHA256_V20;
 if(!catalogHash||!admissionSetHash||! /^[a-f0-9]{64}$/.test(catalogHash)||! /^[a-f0-9]{64}$/.test(admissionSetHash))return null;
 return{catalogHash,admissionSetHash};
}
export {createCloseoutCapabilityVerifierV19};
