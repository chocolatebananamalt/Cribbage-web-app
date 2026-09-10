import Script from "next/script";
import { connection } from "next/server";
import RegistrationForm from "./registration-form";

export default async function RegistrationPage() {
  await connection();
  return <main className="auth-shell"><Script src="/registration-bootstrap.js" strategy="beforeInteractive" /><RegistrationForm /></main>;
}
