export type EmailSignInFailure = {
  message: string;
  cooldownSeconds: number | null;
};

type AuthErrorDetails = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
  retry_after?: unknown;
  retryAfter?: unknown;
  retryAfterSeconds?: unknown;
};

const GENERIC_RATE_LIMIT_MESSAGE =
  "Too many sign-in emails were requested. The exact reset time is unavailable. Use password sign-in or try again later.";

function positiveSeconds(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : null;
}

export function parseEmailRetrySeconds(details: AuthErrorDetails): number | null {
  const supplied = positiveSeconds(details.retryAfterSeconds)
    ?? positiveSeconds(details.retry_after)
    ?? positiveSeconds(details.retryAfter);
  if (supplied !== null) return supplied;

  const message = typeof details.message === "string" ? details.message : "";
  const match = message.match(/(?:after|in)\s+(\d+)\s*(?:seconds?|secs?|s)\b/i)
    ?? message.match(/(\d+)\s*(?:seconds?|secs?|s)\s*(?:remaining|left|before|until|to wait)\b/i);
  return match ? positiveSeconds(match[1]) : null;
}

export function normalizeEmailSignInError(caught: unknown): EmailSignInFailure {
  const details: AuthErrorDetails = caught && typeof caught === "object" ? caught : {};
  const message = typeof details.message === "string" ? details.message.trim() : "";
  const code = typeof details.code === "string" ? details.code.toLowerCase() : "";
  const status = typeof details.status === "number"
    ? details.status
    : typeof caught === "number"
      ? caught
      : Number.NaN;
  const lowered = message.toLowerCase();
  const rateLimited = code === "over_email_send_rate_limit"
    || code === "over_request_rate_limit"
    || status === 429
    || lowered.includes("rate limit")
    || lowered.includes("too many requests");

  if (!rateLimited) return { message: message || "Unable to start sign-in.", cooldownSeconds: null };

  const cooldownSeconds = parseEmailRetrySeconds(details);
  if (cooldownSeconds === null) {
    return { message: GENERIC_RATE_LIMIT_MESSAGE, cooldownSeconds: null };
  }

  const unit = cooldownSeconds === 1 ? "second" : "seconds";
  return {
    message: `Too many sign-in emails were requested. Wait ${cooldownSeconds} ${unit} before requesting another link.`,
    cooldownSeconds,
  };
}
