import { notFound } from "next/navigation";
import Link from "next/link";
import { SharedDeviceSignOut } from "../../../components/shared-device-sign-out";
import { getCurrentSubject } from "../../../lib/auth/current-subject";
import { getDirectorAdminWorkspace } from "../../../lib/director-administration";
import { DirectorAdministrationClient } from "./director-administration-client";

export const dynamic = "force-dynamic";

export default async function DirectorAdministrationPage() {
  const actorId = await getCurrentSubject();
  if (!actorId) notFound();
  const workspace = await getDirectorAdminWorkspace(actorId);
  if (!workspace) notFound();
  return <main className="auth-shell"><section className="auth-card director-admin" aria-labelledby="director-admin-title">
    <p className="eyebrow">PLATFORM ADMINISTRATION</p>
    <h1 id="director-admin-title">Director Administration</h1>
    <p className="lede">Approve app access separately from official ACC verification. Every decision is audited.</p>
    <Link className="secondary admin-link" href="/">Back to Your Tournaments</Link>
    <DirectorAdministrationClient initial={workspace} />
    <SharedDeviceSignOut />
  </section></main>;
}
