import { connection } from "next/server";
import { SharedDeviceSignOut } from "../../../components/shared-device-sign-out";

export default async function OfflineDataBlockedPage() {
  // Rendered per request so the proxy nonce reaches Next bootstrap scripts.
  // Prerendered, those scripts carry no nonce and strict-dynamic blocks every
  // one, so SharedDeviceSignOut never hydrates and both buttons do nothing.
  await connection();
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="offline-data-title"><p className="eyebrow">ACC TOURNAMENT DESK</p><h1 id="offline-data-title">Finish this device’s saved scoring first</h1><p className="lede">This different-account sign-in was not completed because this browser has a private score page or score entry belonging to the current player.</p><p>Return to the current player’s game and sync any saved entry. If this device is changing users and the result is safely recorded elsewhere, use the button below to sign out and clear the private score page and device keys, then request a new sign-in link.</p><SharedDeviceSignOut /></section></main>;
}
