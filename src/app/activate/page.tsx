import { connection } from "next/server";
import { notFound } from "next/navigation";
import { accountActivationEnabled } from "../../lib/api/account-activation-release";
import ActivationForm from "./activation-form";
export default async function ActivatePage() { if (!accountActivationEnabled()) notFound(); await connection(); return <main className="auth-shell"><ActivationForm /></main>; }
