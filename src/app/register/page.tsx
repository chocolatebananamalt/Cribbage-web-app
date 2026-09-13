import Script from "next/script";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { publicRegistrationEnabled } from "../../lib/api/public-registration-v2";
import RegistrationForm from "./registration-form";

export default async function RegistrationPage() {
  // The entire public entry surface stays absent until its separately reviewed
  // release switch is deliberately enabled, matching the claim API boundary.
  if (!publicRegistrationEnabled()) notFound();
  await connection();
  return <main className="auth-shell"><Script src="/registration-bootstrap.js" strategy="beforeInteractive" /><RegistrationForm /></main>;
}
