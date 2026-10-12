// Uses the Web Crypto API (not node:crypto) so this file works in both the
// Node.js API routes and the Edge-runtime middleware without extra config.

export const AUTH_COOKIE = "house-list-auth";

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return secret;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// The secret only changes with a redeploy, so its key is imported once.
let keyPromise: Promise<CryptoKey> | null = null;

/** HMAC-SHA256 of a fixed label under AUTH_SECRET, as hex. */
async function sign(label: string): Promise<string> {
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  let key: CryptoKey;
  try {
    key = await keyPromise;
  } catch (error) {
    keyPromise = null;
    throw error;
  }
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(label)));
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// The cookie value proves the holder passed the PIN check at some point —
// it's a deterministic HMAC of a fixed label, not a per-session token, which
// is fine for a two-person shared-PIN app with no per-user accounts.
export async function computeAuthToken(): Promise<string> {
  return sign("authenticated");
}

export async function isValidAuthToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await computeAuthToken();
  return timingSafeEqualStr(token, expected);
}

export function isValidPin(pin: string): boolean {
  const expected = process.env.HOUSE_PIN;
  if (!expected) {
    throw new Error("HOUSE_PIN environment variable is not set");
  }
  return timingSafeEqualStr(pin, expected);
}

// The calendar feed can't send a cookie (calendar apps fetch it on their own),
// so it's protected by an unguessable token in the URL instead — derived from
// the same secret, so rotating AUTH_SECRET revokes old subscriptions too.
export async function computeCalendarToken(): Promise<string> {
  return (await sign("calendar-feed")).slice(0, 40);
}

export async function isValidCalendarToken(token: string): Promise<boolean> {
  return timingSafeEqualStr(token, await computeCalendarToken());
}

// Claude's connector (claude.ai → Settings → Connectors) can't log in with
// the PIN either, so it gets its own URL token, under a different label so
// the calendar link and the connector link can't stand in for each other.
export async function computeConnectorToken(): Promise<string> {
  return (await sign("claude-connector")).slice(0, 40);
}

export async function isValidConnectorToken(token: string): Promise<boolean> {
  return timingSafeEqualStr(token, await computeConnectorToken());
}

// The AI worker runs on someone's own computer and has no cookie, so it sends
// this as a bearer token. Same secret, its own label: rotating AUTH_SECRET
// revokes it along with everything else.
export async function computeWorkerToken(): Promise<string> {
  return sign("ai-worker");
}

/** Whether a request carries the worker's `Authorization: Bearer` token. */
export async function isWorkerRequest(request: Request): Promise<boolean> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return false;
  return timingSafeEqualStr(token, await computeWorkerToken());
}
