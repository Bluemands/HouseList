import { prisma } from "@/lib/prisma";

// Wrong PINs are counted per IP and across everyone, so the PIN can't be
// guessed by brute force. A successful login clears that IP's count.

type Limit = { key: string; max: number; windowMs: number };

export function loginLimits(ip: string): Limit[] {
  return [
    { key: `ip:${ip}`, max: 10, windowMs: 15 * 60_000 },
    // Spread across many addresses, guessing still hits this ceiling.
    { key: "all", max: 60, windowMs: 60 * 60_000 },
  ];
}

/** Seconds until another attempt is allowed, or 0 if it is now. */
export async function retryAfter(limits: Limit[]): Promise<number> {
  const now = Date.now();
  let wait = 0;
  for (const limit of limits) {
    const row = await prisma.loginThrottle.findUnique({ where: { key: limit.key } });
    if (!row) continue;
    const resetsAt = row.windowStart.getTime() + limit.windowMs;
    if (resetsAt > now && row.failures >= limit.max) wait = Math.max(wait, Math.ceil((resetsAt - now) / 1000));
  }
  return wait;
}

export async function recordFailure(limits: Limit[]) {
  const now = new Date();
  for (const limit of limits) {
    const row = await prisma.loginThrottle.findUnique({ where: { key: limit.key } });
    const expired = !row || row.windowStart.getTime() + limit.windowMs <= now.getTime();
    await prisma.loginThrottle.upsert({
      where: { key: limit.key },
      create: { key: limit.key, failures: 1, windowStart: now },
      update: expired ? { failures: 1, windowStart: now } : { failures: { increment: 1 } },
    });
  }
}

export async function clearFailures(key: string) {
  await prisma.loginThrottle.deleteMany({ where: { key } });
}
