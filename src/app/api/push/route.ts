import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readBody } from "@/lib/api-route";
import { notify, pushConfigured } from "@/lib/push";

const subscribeSchema = z.object({
  member: z.string().trim().min(1).max(60),
  subscription: z.object({
    endpoint: z.url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
  /** A first sign-up gets a notification straight away, to show it works. */
  confirm: z.boolean().optional(),
});

// This phone turns notifications on (or says again whose phone it is).
export async function POST(request: NextRequest) {
  if (!pushConfigured()) {
    return NextResponse.json({ error: "Notifications aren't set up on the server yet" }, { status: 503 });
  }
  const body = await readBody(request, subscribeSchema);
  if ("error" in body) return body.error;
  const { member, subscription, confirm } = body.data;
  const data = { member, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth };
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: { endpoint: subscription.endpoint, ...data },
    update: data,
  });
  if (confirm) {
    await notify(
      { title: "Notifications are on", body: "You'll hear when things change on the list.", tag: "push-on" },
      { endpoint: subscription.endpoint },
    );
  }
  return NextResponse.json({ ok: true });
}

const unsubscribeSchema = z.object({ endpoint: z.url() });

// This phone turns them off.
export async function DELETE(request: NextRequest) {
  const body = await readBody(request, unsubscribeSchema);
  if ("error" in body) return body.error;
  await prisma.pushSubscription.deleteMany({ where: { endpoint: body.data.endpoint } });
  return NextResponse.json({ ok: true });
}
