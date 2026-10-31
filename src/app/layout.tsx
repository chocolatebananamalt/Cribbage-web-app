import type { Metadata } from "next";
import "./globals.css";
import { RecoveryDocumentBoundary } from "../components/recovery-document-boundary";
import { getCurrentSubject } from "../lib/auth/current-subject";

export const metadata: Metadata = {
  title: "ACC Tournament Desk",
  description: "Accessible tournament operations for American Cribbage Congress events.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actorId = await getCurrentSubject();
  return (
    <html lang="en">
      <body><div id="acc-recovery-frozen-shield" role="alert">This saved page is paused to protect recovery work. Reload before using tournament operations. Do not clear pending data.</div><div id="acc-recovery-live-app"><RecoveryDocumentBoundary actorId={actorId}>{children}</RecoveryDocumentBoundary></div></body>
    </html>
  );
}
