import webpush from "web-push";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Notifications on your phones (web push). A phone turns them on in Settings
 * and is stored with whose phone it is, so a change buzzes the other person's
 * phone, not the one that made it. Nothing here ever fails a request: a push
 * that can't be delivered is logged, and a phone that's gone is forgotten.
 */

export type PushMessage = {
  title: string;
  body: string;
  /** Where a tap takes you, e.g. "/?item=…". */
  url?: string;
  /** A newer notification with the same tag replaces the older one. */
  tag?: string;
};

type Who = { to: string } | { except: string } | { endpoint: string } | "everyone";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

export function pushConfigured() {
  return !!publicKey && !!privateKey;
}

function vapid() {
  // Push services want a way to reach whoever sends; the site's own address does.
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const subject = process.env.VAPID_SUBJECT ?? (site ? `https://${site}` : "https://localhost");
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
}

function where(who: Who) {
  if (who === "everyone") return {};
  if ("to" in who) return { member: who.to };
  if ("endpoint" in who) return { endpoint: who.endpoint };
  return { member: { not: who.except } };
}

export async function notify(message: PushMessage, who: Who) {
  if (!pushConfigured()) return;
  const phones = await prisma.pushSubscription.findMany({ where: where(who) });
  if (!phones.length) return;
  vapid();
  const payload = JSON.stringify(message);
  await Promise.all(
    phones.map(async (phone) => {
      try {
        await webpush.sendNotification(
          { endpoint: phone.endpoint, keys: { p256dh: phone.p256dh, auth: phone.auth } },
          payload,
          // Kept a day for a phone that's off; after that it's old news.
          { TTL: 24 * 60 * 60 },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // Gone: notifications turned off in the browser, or the app removed.
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: phone.endpoint } });
        } else {
          console.error(`Couldn't send a notification (${status ?? "no status"})`, err);
        }
      }
    }),
  );
}

/**
 * Once the response has gone, so nobody waits on a push service: `build`
 * works out what to say and to whom from how things stand by then, or
 * returns null to stay quiet.
 */
export function notifyWhenReady(build: () => Promise<{ message: PushMessage; who: Who } | null>) {
  if (!pushConfigured()) return;
  after(async () => {
    try {
      const out = await build();
      if (out) await notify(out.message, out.who);
    } catch (err) {
      console.error("Couldn't send a notification", err);
    }
  });
}

/**
 * The same with a message known now. `unless` is checked after `delayMs`:
 * a tick that's undone inside the undo window never buzzes anyone.
 */
export function notifyLater(
  message: PushMessage,
  who: Who,
  { delayMs = 0, unless }: { delayMs?: number; unless?: () => Promise<boolean> } = {},
) {
  notifyWhenReady(async () => {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return unless && (await unless()) ? null : { message, who };
  });
}

/** "/?item=…": the app opens that item's sheet. */
export const itemUrl = (id: string) => `/?item=${encodeURIComponent(id)}`;

/** Shortened for a notification line. */
export function clip(text: string, max = 120) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
