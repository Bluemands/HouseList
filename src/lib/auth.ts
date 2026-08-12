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
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode("authenticated"));
  return toHex(signature);
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
