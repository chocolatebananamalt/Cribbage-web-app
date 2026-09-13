import { redirect } from "next/navigation";
import { getCurrentSubject } from "../../lib/auth/current-subject";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const subject = await getCurrentSubject();
  if (subject) redirect("/");
  const query = await searchParams;
  return <SignInForm handoffWarning={query.notice === "local_clear_review"} />;
}
