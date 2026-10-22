import { formatGBP } from "@/lib/format";
import { clip, notifyLater } from "@/lib/push";
import { owesLine, paidLine, type PaymentDTO } from "@/lib/payments";

// What the other one of you hears about money between you. A tick or a
// settle-up waits out the undo window first, so one taken back never buzzes.

const MONEY_URL = "/?v=money";
const UNDO_WINDOW_MS = 7_000;

/** The other side of it from whoever did this; with neither of them, everyone else. */
function audience(p: Pick<PaymentDTO, "owedBy" | "owedTo">, actor: string) {
  const other = p.owedBy === actor ? p.owedTo : p.owedTo === actor ? p.owedBy : null;
  return other ? { to: other } : { except: actor };
}

/** The line as the person hearing it would say it. */
const hearer = (who: { to: string } | { except: string }) => ("to" in who ? who.to : "");

export function notifyLogged(p: PaymentDTO) {
  const who = audience(p, p.addedBy);
  notifyLater(
    {
      title: `${p.addedBy} logged ${clip(p.description, 60)}`,
      body: `${owesLine(p.owedBy, p.owedTo, hearer(who))} ${formatGBP(p.amount)}`,
      url: MONEY_URL,
      tag: `payment-${p.id}`,
    },
    who,
  );
}

export function notifyPaid(p: PaymentDTO, actor: string, stillPaid: () => Promise<boolean>) {
  const who = audience(p, actor);
  notifyLater(
    {
      title: `${actor} ticked off ${clip(p.description, 60)}`,
      body: `${paidLine(p.owedBy, p.owedTo, hearer(who))} ${formatGBP(p.amount)}`,
      url: MONEY_URL,
      tag: `payment-${p.id}`,
    },
    who,
    { delayMs: UNDO_WINDOW_MS, unless: async () => !(await stillPaid()) },
  );
}

export function notifySettled(
  settled: PaymentDTO[],
  net: { from: string | null; to: string | null; amount: number },
  actor: string,
  stillSettled: () => Promise<boolean>,
) {
  const who = audience(settled[0], actor);
  const count = `${settled.length} ${settled.length === 1 ? "payment" : "payments"}`;
  notifyLater(
    {
      title: `${actor} settled up`,
      body:
        net.from && net.to
          ? `${paidLine(net.from, net.to, hearer(who))} ${formatGBP(net.amount)}, clearing ${count}`
          : `It came out even, clearing ${count}`,
      url: MONEY_URL,
      tag: "payments-settled",
    },
    who,
    { delayMs: UNDO_WINDOW_MS, unless: async () => !(await stillSettled()) },
  );
}
