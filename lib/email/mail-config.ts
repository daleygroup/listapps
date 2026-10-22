/**
 * Outgoing email, provider-neutral (CLAUDE.md: no vendor logic hardcoded).
 *
 * No email service is chosen yet (D-005), so every mailer built here reports
 * "not sent" with a plain reason. When D-005 is answered, only
 * `mailerFromEnv` gains a real provider; callers already handle both results.
 *
 * Links in emails (invitation links carry a one-time token) are built ONLY
 * from the pinned `LISTAPPS_SITE_URL`, never from request headers: a forged
 * Host header must never be able to put an attacker's domain, and therefore
 * a working join token, into an email we send.
 */
export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

export type SendResult = { sent: true } | { sent: false; reason: string };

export interface Mailer {
  send(email: OutgoingEmail): Promise<SendResult>;
}

type Env = Record<string, string | undefined>;

export const EMAIL_NOT_CHOSEN =
  "No email service is set up yet (decision D-005).";
export const SITE_URL_MISSING =
  "The site address (LISTAPPS_SITE_URL) is not set, so links cannot be emailed safely.";

/**
 * The origin used for every link we email, or null when it is not pinned.
 * Throws on a value that is set but unsafe, so a misconfiguration is loud.
 */
export function emailLinkOrigin(env: Env): string | null {
  const raw = env.LISTAPPS_SITE_URL?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("LISTAPPS_SITE_URL is not a valid URL.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("LISTAPPS_SITE_URL must use https.");
  }
  return url.origin;
}

function notSending(reason: string): Mailer {
  return { send: async () => ({ sent: false, reason }) };
}

export function mailerFromEnv(env: Env): Mailer {
  if (!emailLinkOrigin(env)) return notSending(SITE_URL_MISSING);
  // D-005: a real provider is wired here once Joseph chooses one.
  return notSending(EMAIL_NOT_CHOSEN);
}

/**
 * Next.js inlines env reads only when referenced literally, so server code
 * reads through this rather than passing `process.env` around.
 */
export function mailEnvFromProcess(): Env {
  return { LISTAPPS_SITE_URL: process.env.LISTAPPS_SITE_URL };
}
