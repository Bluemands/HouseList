"use client";

/**
 * This phone's side of notifications: the service worker that receives them
 * (public/sw.js) and the browser's push sign-up, kept in step with the server
 * so it knows whose phone this is.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushState =
  /** No server key, or a browser without push (an iPhone not added to the home screen). */
  | "unsupported"
  /** Turned down in the browser; only its own settings can undo that. */
  | "blocked"
  | "off"
  | "on";

export function pushSupported() {
  return (
    !!PUBLIC_KEY &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iPhones only get notifications from the app added to the home screen. */
export function isIphoneInBrowser() {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return ios && !window.matchMedia("(display-mode: standalone)").matches;
}

function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const sub = await (await registration()).pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function send(method: "POST" | "DELETE", body: unknown) {
  const res = await fetch("/api/push", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't reach the server");
}

/** Ask for permission, sign this phone up, and send a first notification to show it works. */
export async function turnOnPush(member: string): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY!) }));
  await send("POST", { member, subscription: sub.toJSON(), confirm: true });
  return "on";
}

export async function turnOffPush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const sub = await (await registration()).pushManager.getSubscription();
  if (sub) {
    await send("DELETE", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }
  return "off";
}

/**
 * On opening the app: if this phone has notifications on, tell the server
 * again whose phone it is (the name can change), and keep the service
 * worker current. Quiet if anything's missing.
 */
export async function refreshPush(member: string) {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const sub = await (await registration()).pushManager.getSubscription();
    if (sub) await send("POST", { member, subscription: sub.toJSON() });
  } catch {
    // Next time.
  }
}
