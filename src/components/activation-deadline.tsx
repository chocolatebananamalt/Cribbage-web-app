/** Presentation only: the server enforces the activation's original deadline. */
export function ActivationDeadline({ expiresAt }: { expiresAt?: string }) {
  return <p className="auth-note">Both player redemption and director approval must finish before the original deadline. {expiresAt
    ? <>Deadline: <time dateTime={expiresAt}>{new Date(expiresAt).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}</time>.</>
    : <>This server did not return the exact time. Ask the director for the original link deadline and complete approval promptly.</>}
    {" "}Signing in or redeeming the link does not extend it. If it expires, ask the director for a replacement link and repeat the witnessed request.</p>;
}
