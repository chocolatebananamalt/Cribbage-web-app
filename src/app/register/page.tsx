import Script from "next/script";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { publicRegistrationEnabled } from "../../lib/api/public-registration-v2";
import RegistrationForm from "./registration-form";

export default async function RegistrationPage() {
  // The entire public entry surface stays absent until its separately reviewed
  // release switch is deliberately enabled, matching the claim API boundary.
  // connection() first: reading the flag before it bakes this route
  // prerendered, so the build-time flag value becomes permanent and
  // enabling the release switch in production changes nothing.
  await connection();
  if (!publicRegistrationEnabled()) notFound();
  return <main className="auth-shell"><Script src="/registration-bootstrap.js" strategy="beforeInteractive" /><RegistrationForm /></main>;
}
