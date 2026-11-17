import { notFound } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/server';
import { identityAccessV5 } from '../../../../lib/identity-v5/provider';
import { requireVerifiedIdentity } from '../../../../lib/api/verified-subject';
import { legacyRegistrationEnabledV25 } from '../../../../lib/legacy-registration-v25/gate';
import { LegacyRegistrationClientV25 } from '../../../../components/legacy-registration-client-v25';
import { RecoveryDocumentBoundary } from '../../../../components/recovery-document-boundary';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{tournamentId:string}>}) {
  if(!legacyRegistrationEnabledV25())notFound();
  const{tournamentId}=await params,user=await createClient(),a=await identityAccessV5(user,tournamentId),last=await requireVerifiedIdentity(user);
  if(!a||last?.subject!==a.actorId||last.sessionId!==a.sessionId)notFound();
  return <RecoveryDocumentBoundary actorId={a.actorId}><p>Local reviewed paper-registration bridge. Existing manual and digital registration are unchanged.</p><LegacyRegistrationClientV25 actorId={a.actorId} tournamentId={tournamentId}/></RecoveryDocumentBoundary>;
}
