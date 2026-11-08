/** Reviewed local activation candidate, not an account/event authorization.
 * The existing public URL confines these entry points to the separate test
 * project. Every operation still requires current session, role, event scope,
 * consent and expiry in the server/database. No new environment secret. */
export const nativeMixedPlayProjectV1='nnhcnvksxgxnpvdqjgpg';
export const nativeMixedPlayUrlV1=`https://${nativeMixedPlayProjectV1}.supabase.co`;
export function nativeMixedPlayActivationEnabledV1(){
 return process.env.NEXT_PUBLIC_SUPABASE_URL===nativeMixedPlayUrlV1;
}
