import Script from "next/script";
import RegistrationForm from "./registration-form";

export default function RegistrationPage() {
  return <main className="auth-shell"><Script src="/registration-bootstrap.js" strategy="beforeInteractive" /><RegistrationForm /></main>;
}
