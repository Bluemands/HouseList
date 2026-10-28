"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSheetExit } from "@/lib/useSheetDrag";
import { describeDay, formatGBP, today } from "@/lib/format";
import {
  DESCRIPTION_MAX,
  SHARE_PRESETS,
  balances,
  clearedIn,
  half,
  history,
  owesLine,
  paidLine,
  paysLine,
  pence,
  recentDescriptions,
  shareOf,
  splitNote,
  type Balance,
  type HistoryEntry,
  type PaymentDTO,
} from "@/lib/payments";
import type { ItemDTO } from "@/lib/types";
import { MiniSheet } from "@/components/MiniSheet";
import { Button, Chip, Field, MoneyInput, SectionHead, Segmented, TickButton, inputClass } from "@/components/ui";

// "Between us": money one of you owes the other, ticked off as it's paid or
// all at once by settling up. On the Money tab it's always there; on the
// simple layout it only shows while something's owed, with a quiet way in
// at the foot of the list for the rest of the time.

type SheetState = { kind: "add" } | { kind: "edit"; payment: PaymentDTO } | { kind: "settle"; people: [string, string] };

/** "3 Oct", "today", "yesterday". */
const shortDay = (day: string) => describeDay(day).replace(/^on /, "");

const samePeople = (a: [string, string], b: [string, string]) => a[0] === b[0] && a[1] === b[1];

/** On the Money tab. */
export function BetweenUs() {
  const [sheet, setSheet] = useState<SheetState | null>(null);
  return (
    <section aria-labelledby="between-head">
      <SectionHead id="between-head" title="Between us">
        <Button variant="ghost" onClick={() => setSheet({ kind: "add" })} className="-mr-2 px-3 py-1.5">
          <Plus size={16} /> Log a payment
        </Button>
      </SectionHead>
      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-4">
        <BetweenUsBody sheet={sheet} onSheet={setSheet} />
      </div>
    </section>
  );
}

/** On the simple layout's home: only while something's owed. */
export function BetweenUsCard() {
  const { payments } = useStore();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const owed = payments.some((p) => !p.paidOn);
  // Kept while a sheet is up, so ticking off the last one doesn't pull the sheet out from under it.
  if (!owed && !sheet) return null;
  return (
    <section aria-labelledby="between-head" className="grid gap-4 rounded-2xl border border-line bg-surface p-4">
      <h2 id="between-head" className="text-title font-bold tracking-[-0.01em] text-ink">
        Between us
      </h2>
      <BetweenUsBody sheet={sheet} onSheet={setSheet} simple />
    </section>
  );
}

/** At the foot of the simple layout, when nothing's owed: logging a payment and the history. */
export function BetweenUsLink() {
  const { payments } = useStore();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const panel = useSheetExit(open || null);
  if (payments.some((p) => !p.paidOn) && !open) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-self-center rounded-full px-4 text-supporting font-medium text-ink-2 hover:bg-sunken hover:text-ink"
      >
        Money between us
      </button>
      {panel.shown && (
        <MiniSheet key={panel.opening} title="Between us" leaving={panel.leaving} onClose={() => setOpen(false)}>
          <BetweenUsBody sheet={sheet} onSheet={setSheet} simple />
        </MiniSheet>
      )}
    </>
  );
}

function BetweenUsBody({
  sheet,
  onSheet,
  simple = false,
}: {
  sheet: SheetState | null;
  onSheet: (s: SheetState | null) => void;
  simple?: boolean;
}) {
  const { payments } = useStore();
  const pairs = useMemo(() => balances(payments), [payments]);
  const anyPaid = payments.some((p) => p.paidOn);
  const shown = useSheetExit(sheet);
  const close = () => onSheet(null);

  return (
    <>
      {pairs.length === 0 ? (
        <div className="grid gap-1">
          <p className="text-title font-bold text-ink">All square</p>
          <p className="text-supporting text-ink-2">
            {payments.length
              ? "Nothing owed either way."
              : "When one of you pays a bill, log it here and the other’s half is kept track of until it’s paid."}
          </p>
        </div>
      ) : (
        pairs.map((b) => (
          <OpenPayments
            key={b.people.join("|")}
            balance={b}
            simple={simple}
            onEdit={(payment) => onSheet({ kind: "edit", payment })}
            onSettle={() => onSheet({ kind: "settle", people: b.people })}
          />
        ))
      )}

      {/* On the Money tab, the section's heading has it. */}
      {simple && (
        <Button
          variant={pairs.length ? "secondary" : "primary"}
          onClick={() => onSheet({ kind: "add" })}
          className={clsx("justify-self-start", simple && "min-h-11")}
        >
          <Plus size={16} /> Log a payment
        </Button>
      )}

      {anyPaid && <History simple={simple} onEdit={(payment) => onSheet({ kind: "edit", payment })} />}

      {shown.shown?.kind === "settle" ? (
        <SettleSheet key={shown.opening} people={shown.shown.people} leaving={shown.leaving} onClose={close} />
      ) : shown.shown ? (
        <PaymentSheet
          key={shown.opening}
          payment={shown.shown.kind === "edit" ? shown.shown.payment : null}
          leaving={shown.leaving}
          onClose={close}
        />
      ) : null}
    </>
  );
}

/** What's owed between two people: the balance, settling up, and each payment to tick. */
function OpenPayments({
  balance,
  simple,
  onEdit,
  onSettle,
}: {
  balance: Balance;
  simple: boolean;
  onEdit: (p: PaymentDTO) => void;
  onSettle: () => void;
}) {
  const { me, togglePaid } = useStore();
  const { from, to, amount, open } = balance;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <p className="text-sheet-title leading-tight font-bold tracking-[-0.02em] text-ink tabular">
          {from && to ? (
            <>
              {owesLine(from, to, me)} {formatGBP(amount)}
            </>
          ) : (
            "Even, either way"
          )}
        </p>
        {open.length > 1 && (
          <Button onClick={onSettle} className={clsx(simple && "min-h-11")}>
            Settle up
          </Button>
        )}
      </div>
      <ul className="border-t border-line">
        {open.map((p) => (
          <li key={p.id} className="flex items-center gap-3 border-b border-line py-2.5 pl-1 last:border-b-0">
            <TickButton
              done={false}
              room="WHOLE_HOUSE"
              label={p.description}
              onToggle={() => togglePaid(p)}
              size={simple ? "lg" : "md"}
            />
            <button type="button" onClick={() => onEdit(p)} className="min-w-0 flex-1 text-left">
              <span className={clsx("block truncate font-medium text-ink", simple ? "text-title" : "text-body")}>
                {p.description}
              </span>
              <span className="block text-meta text-ink-3">
                {owesLine(p.owedBy, p.owedTo, me)} · {shortDay(p.billedOn)}
                {p.billTotal != null && ` · ${splitNote(p, formatGBP)}`}
              </span>
            </button>
            <span className="shrink-0 font-semibold text-ink tabular">{formatGBP(p.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const HISTORY_PAGE = 8;

/** What's been paid, newest first, with what was cleared this year. */
function History({ simple, onEdit }: { simple: boolean; onEdit: (p: PaymentDTO) => void }) {
  const { payments, me } = useStore();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(HISTORY_PAGE);
  const entries = useMemo(() => history(payments), [payments]);
  const year = today().slice(0, 4);
  const cleared = useMemo(() => clearedIn(payments, year), [payments, year]);
  const who = (name: string) => (name === me ? "you" : name);

  return (
    <div className="border-t border-line pt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-supporting font-semibold text-ink-2 hover:text-ink"
      >
        History
        <ChevronDown size={17} className={clsx("transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div className="grid gap-2 pb-1">
          {cleared.length > 0 && (
            <p className="text-meta text-ink-3">
              Cleared in {year}:{" "}
              {cleared.map((c, i) => (
                <span key={`${c.owedBy}|${c.owedTo}`}>
                  {i > 0 && " · "}
                  {who(c.owedBy).replace(/^./, (l) => l.toUpperCase())} to {who(c.owedTo)}{" "}
                  <span className="font-semibold text-ink-2 tabular">{formatGBP(c.amount)}</span>
                </span>
              ))}
            </p>
          )}
          <ul>
            {entries.slice(0, limit).map((e) =>
              e.settlementId ? (
                <SettlementRow key={e.key} entry={e} simple={simple} />
              ) : (
                <li key={e.key}>
                  <button
                    type="button"
                    onClick={() => onEdit(e.payments[0])}
                    className="flex w-full items-center gap-3 py-2 text-left"
                  >
                    <PaidMark />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-ink">{e.payments[0].description}</span>
                      <span className="block text-meta text-ink-3">
                        {paidLine(e.from!, e.to!, me)} · {shortDay(e.paidOn)}
                      </span>
                    </span>
                    <span className="shrink-0 text-ink-2 tabular">{formatGBP(e.amount)}</span>
                  </button>
                </li>
              ),
            )}
          </ul>
          {entries.length > limit && (
            <Button variant="ghost" onClick={() => setLimit((l) => l + HISTORY_PAGE * 2)} className="justify-self-start px-2">
              Show more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function PaidMark() {
  return (
    <span aria-hidden="true" className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text">
      <Check size={14} strokeWidth={2.6} />
    </span>
  );
}

/** One settle-up: what it came to, what it cleared, and its date to put right. */
function SettlementRow({ entry, simple }: { entry: HistoryEntry; simple: boolean }) {
  const { me, redateSettlement, reopenPayments } = useStore();
  const [open, setOpen] = useState(false);
  const { from, to, amount, payments, settlementId, paidOn } = entry;
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 py-2 text-left">
        <PaidMark />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-ink">
            Settled up{from && to ? `: ${paidLine(from, to, me)}` : ", all square"}
          </span>
          <span className="block text-meta text-ink-3">
            {payments.length} payments · {shortDay(paidOn)}
          </span>
        </span>
        <span className="shrink-0 text-ink-2 tabular">{from ? formatGBP(amount) : null}</span>
        <ChevronDown size={16} className={clsx("shrink-0 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div className="mb-2 ml-[38px] grid gap-3 rounded-xl bg-sunken p-3">
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {payments.map((p) => (
              <li key={p.id} className="flex items-baseline gap-2 text-supporting">
                <span className="min-w-0 flex-1 truncate text-ink">{p.description}</span>
                <span className="shrink-0 text-meta text-ink-3">{owesLine(p.owedBy, p.owedTo, me)}</span>
                <span className="shrink-0 text-ink-2 tabular">{formatGBP(p.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-meta font-semibold whitespace-nowrap text-ink-2">
              Paid on
              <input
                type="date"
                value={paidOn}
                max={today()}
                onChange={(e) => e.target.value && settlementId && redateSettlement(settlementId, e.target.value)}
                className={clsx(inputClass, "w-auto py-1.5 tabular", simple && "py-2")}
              />
            </label>
            <Button variant="ghost" onClick={() => reopenPayments(payments)} className="px-2.5 py-1.5">
              Not paid after all
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Settling up: everything open between two people as one payment, ticked off together. */
function SettleSheet({ people, leaving, onClose }: { people: [string, string]; leaving: boolean; onClose: () => void }) {
  const { payments, me, settleUp } = useStore();
  // Live, so a payment the other phone ticks off meanwhile drops out of it.
  const balance = useMemo(() => balances(payments).find((b) => samePeople(b.people, people)), [payments, people]);
  const [paidOn, setPaidOn] = useState(today());
  const [busy, setBusy] = useState(false);
  const count = balance?.open.length ?? 0;

  async function confirm() {
    if (!balance || busy) return;
    setBusy(true);
    const ok = await settleUp(balance.open, paidOn || today());
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <MiniSheet
      title="Settle up"
      leaving={leaving}
      onClose={onClose}
      footer={
        <Button onClick={confirm} disabled={!count || busy} className="min-h-11 flex-1">
          Mark {count === 1 ? "it" : `all ${count}`} paid
        </Button>
      }
    >
      {!balance ? (
        <p className="text-body text-ink-2">Nothing left to settle: it’s all been paid.</p>
      ) : (
        <>
          <div className="grid gap-1">
            <p className="text-headline leading-tight font-bold tracking-[-0.025em] text-ink tabular">
              {balance.from && balance.to ? `${paysLine(balance.from, balance.to, me)} ${formatGBP(balance.amount)}` : "You’re even"}
            </p>
            <p className="text-supporting text-ink-2">
              {balance.from
                ? `One payment clears ${count === 1 ? "it" : `all ${count} below`}${
                    balance.open.some((p) => p.owedBy !== balance.open[0].owedBy) ? ", both ways" : ""
                  }.`
                : `What’s owed each way cancels out, so this just ticks off all ${count}.`}
            </p>
          </div>
          <ul className="border-y border-line">
            {balance.open.map((p) => (
              <li key={p.id} className="flex items-baseline gap-3 border-b border-line py-2 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">{p.description}</span>
                  <span className="block text-meta text-ink-3">{owesLine(p.owedBy, p.owedTo, me)}</span>
                </span>
                <span className="shrink-0 text-ink-2 tabular">{formatGBP(p.amount)}</span>
              </li>
            ))}
          </ul>
          <Field label="Paid on" hint="If it went over on another day, change it here.">
            <input
              type="date"
              value={paidOn}
              max={today()}
              onChange={(e) => setPaidOn(e.target.value)}
              className={clsx(inputClass, "tabular")}
            />
          </Field>
        </>
      )}
    </MiniSheet>
  );
}

/**
 * On a finished item one of you paid for: split what it cost with the other,
 * and what's been split of it already.
 */
export function SplitField({ item }: { item: ItemDTO }) {
  const { payments, me } = useStore();
  const [open, setOpen] = useState(false);
  const sheet = useSheetExit(open || null);
  const linked = payments.filter((p) => p.itemId === item.id);
  const cost = item.actualPrice ?? item.estimatedPrice;
  if (!linked.length && !cost) return null;
  return (
    <div className="grid justify-items-start gap-1.5">
      {linked.map((p) => (
        <p key={p.id} className="text-supporting text-ink-2">
          Split: {owesLine(p.owedBy, p.owedTo, me)} <span className="font-semibold text-ink tabular">{formatGBP(p.amount)}</span>
          {" · "}
          {p.paidOn ? `paid ${describeDay(p.paidOn)}` : "not paid yet"}
        </p>
      ))}
      {!linked.length && cost != null && (
        <Button variant="secondary" onClick={() => setOpen(true)} className="px-3 py-2">
          Split it: {formatGBP(half(cost))} each
        </Button>
      )}
      {sheet.shown && (
        <PaymentSheet
          key={sheet.opening}
          payment={null}
          from={{ itemId: item.id, title: item.title, cost: cost ?? 0 }}
          leaving={sheet.leaving}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

type Direction = "theyOwe" | "iOwe";

/** How much of the bill is owed: half, a percentage or an exact amount of it, or all of it. */
type Share = { mode: "half" | "custom" | "all"; pct: number | null; exact: string };
const HALF: Share = { mode: "half", pct: null, exact: "" };

/** The share a logged payment used, to edit it or log the same again. */
function shareFrom(p: Pick<PaymentDTO, "amount" | "billTotal">): Share {
  if (p.billTotal == null) return { ...HALF, mode: "all" };
  if (p.amount === half(p.billTotal)) return HALF;
  const pct = SHARE_PRESETS.find((s) => shareOf(p.billTotal!, s) === p.amount);
  return pct ? { mode: "custom", pct, exact: "" } : { mode: "custom", pct: null, exact: String(p.amount) };
}

/** Logging a payment, or putting one right (its paid date too). */
function PaymentSheet({
  payment,
  from,
  leaving,
  onClose,
}: {
  payment: PaymentDTO | null;
  /** Splitting something bought from the list: what it was and what it cost. */
  from?: { itemId: string; title: string; cost: number };
  leaving: boolean;
  onClose: () => void;
}) {
  const { payments, me, settings, itemById, addPayment, updatePayment, removePayment, openItem } = useStore();
  const linked = payment?.itemId ? itemById.get(payment.itemId) : undefined;
  // Who the other person is: from the payment being edited, else whoever else uses the app.
  const others = useMemo(() => {
    const names = settings.members.filter((m) => m.toLowerCase() !== me.toLowerCase());
    if (payment) {
      const party = payment.owedBy === me ? payment.owedTo : payment.owedTo === me ? payment.owedBy : null;
      if (party && !names.includes(party)) names.unshift(party);
    }
    return names;
  }, [settings.members, me, payment]);
  // Someone else's payment between two other people: shown from the side of the one owed.
  const self = payment && payment.owedBy !== me && payment.owedTo !== me ? payment.owedTo : me;

  const [description, setDescription] = useState(payment?.description ?? from?.title ?? "");
  const [total, setTotal] = useState(payment ? String(payment.billTotal ?? payment.amount) : from ? String(from.cost) : "");
  const [share, setShare] = useState<Share>(payment ? shareFrom(payment) : HALF);
  const [other, setOther] = useState(
    payment ? (payment.owedBy === self ? payment.owedTo : payment.owedBy) : (others[0] ?? ""),
  );
  const [direction, setDirection] = useState<Direction>(payment && payment.owedBy === self ? "iOwe" : "theyOwe");
  const [billedOn, setBilledOn] = useState(payment?.billedOn ?? today());
  const [paidOn, setPaidOn] = useState<string | null>(payment?.paidOn ?? null);
  const [busy, setBusy] = useState(false);

  const recent = useMemo(
    () =>
      payment
        ? []
        : recentDescriptions(payments, 4).filter((r) => r.description.toLowerCase() !== description.trim().toLowerCase()),
    [payment, payments, description],
  );

  const n = Number(total.replace(/,/g, ""));
  const bill = Number.isFinite(n) && n > 0 ? pence(n) : null;
  const exact = Number(share.exact.replace(/,/g, ""));
  const amount =
    bill == null
      ? null
      : share.mode === "half"
        ? half(bill)
        : share.mode === "all"
          ? bill
          : share.pct != null
            ? shareOf(bill, share.pct)
            : Number.isFinite(exact) && exact > 0
              ? pence(exact)
              : null;
  const split = share.mode !== "all";
  const overBill = split && bill != null && amount != null && amount > bill;
  const name = other.trim();
  const [owedBy, owedTo] = direction === "iOwe" ? [self, name] : [name, self];
  // Whose share it is, in the words of whoever's looking.
  const debtor = owedBy === me ? "Your" : name ? `${name}’s` : "Their";
  const ready =
    description.trim().length > 0 &&
    amount != null &&
    amount > 0 &&
    !overBill &&
    !!name &&
    name.toLowerCase() !== self.toLowerCase();

  function applyRecent(r: (typeof recent)[number]) {
    setDescription(r.description);
    setTotal(String(r.billTotal ?? r.amount));
    setShare(shareFrom(r));
    if (r.owedBy === me || r.owedTo === me) {
      setDirection(r.owedBy === me ? "iOwe" : "theyOwe");
      setOther(r.owedBy === me ? r.owedTo : r.owedBy);
    }
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    const fields = {
      description: description.trim(),
      amount: amount!,
      billTotal: split ? bill : null,
      owedBy,
      owedTo,
      billedOn: billedOn || today(),
    };
    const saved = payment
      ? await updatePayment(payment, { ...fields, ...(paidOn !== payment.paidOn && { paidOn }) })
      : await addPayment({ ...fields, itemId: from?.itemId ?? null });
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <MiniSheet
      title={payment ? "Payment" : "Log a payment"}
      leaving={leaving}
      onClose={onClose}
      footer={
        <>
          {payment && (
            <Button
              variant="danger"
              onClick={() => {
                removePayment(payment);
                onClose();
              }}
              aria-label="Delete this payment"
              className="min-h-11 px-3"
            >
              <Trash2 size={17} />
            </Button>
          )}
          <Button type="submit" form="payment-form" disabled={!ready || busy} className="min-h-11 flex-1">
            {payment ? "Save" : amount ? `Log ${formatGBP(amount)}` : "Log it"}
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={save} className="grid gap-4">
        {linked && (
          <button
            type="button"
            onClick={() => {
              onClose();
              openItem(linked.id);
            }}
            className="justify-self-start text-supporting font-medium text-accent-text hover:underline"
          >
            From the list: {linked.title}
          </button>
        )}
        <Field label="What for">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Council tax, October"
            maxLength={DESCRIPTION_MAX}
            autoFocus={!payment}
            enterKeyHint="next"
            className={inputClass}
          />
          {recent.length > 0 && (
            <div className="rail -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
              {recent.map((r) => (
                <Chip key={r.description} selected={false} onClick={() => applyRecent(r)} className="py-2">
                  {r.description}
                </Chip>
              ))}
            </div>
          )}
        </Field>

        <Field label="How much of it">
          <Segmented
            label="How much of it"
            value={share.mode}
            onChange={(mode) => setShare(mode === "custom" ? { mode, pct: SHARE_PRESETS[1], exact: "" } : { ...HALF, mode })}
            options={[
              { value: "half", label: "Half each" },
              { value: "custom", label: "Custom" },
              { value: "all", label: "All of it" },
            ]}
          />
        </Field>

        <Field
          label={split ? "The whole bill" : "What’s owed"}
          hint={
            overBill
              ? "That’s more than the whole bill."
              : split && amount && name
                ? `So ${owesLine(owedBy, owedTo, me).replace(/^You /, "you ")} ${formatGBP(amount)}${
                    share.mode === "custom" && bill ? ` (${splitNote({ amount, billTotal: bill }, formatGBP)})` : ""
                  }`
                : undefined
          }
        >
          <MoneyInput label={split ? "The whole bill" : "What’s owed"} value={total} onChange={setTotal} placeholder="0.00" />
        </Field>

        {share.mode === "custom" && (
          <Field label={`${debtor} share`}>
            <div className="flex flex-wrap gap-1.5">
              {SHARE_PRESETS.map((pct) => (
                <Chip key={pct} selected={share.pct === pct} onClick={() => setShare({ mode: "custom", pct, exact: "" })}>
                  {pct}%
                </Chip>
              ))}
              <Chip
                selected={share.pct == null}
                onClick={() =>
                  setShare({ mode: "custom", pct: null, exact: amount != null && share.pct != null ? String(amount) : share.exact })
                }
              >
                Exact amount
              </Chip>
            </div>
            {share.pct == null && (
              <MoneyInput
                label={`${debtor} share, in pounds`}
                value={share.exact}
                onChange={(exact) => setShare({ mode: "custom", pct: null, exact })}
                placeholder="0.00"
              />
            )}
          </Field>
        )}

        <Field label="Who owes whom">
          {others.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {others.map((o) => (
                <Chip key={o} selected={other === o} onClick={() => setOther(o)}>
                  {o}
                </Chip>
              ))}
            </div>
          )}
          {others.length === 0 && (
            <input
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="Their name"
              aria-label="The other person’s name"
              maxLength={60}
              className={inputClass}
            />
          )}
          <Segmented
            label="Who owes whom"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "theyOwe", label: owesLine(name || "They", self, me).replace(/^They owes/, "They owe") },
              { value: "iOwe", label: owesLine(self, name || "them", me) },
            ]}
          />
        </Field>

        <Field label="Date of the bill">
          <input type="date" value={billedOn} onChange={(e) => setBilledOn(e.target.value)} className={clsx(inputClass, "tabular")} />
        </Field>

        {payment && (
          <Field label="Paid" hint={paidOn ? "Change it if it was paid on another day than it was ticked off." : undefined}>
            {paidOn ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={paidOn}
                  max={today()}
                  onChange={(e) => e.target.value && setPaidOn(e.target.value)}
                  aria-label="Paid on"
                  className={clsx(inputClass, "tabular")}
                />
                <Button variant="ghost" onClick={() => setPaidOn(null)} className="shrink-0 px-3">
                  Not paid yet
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setPaidOn(today())} className="justify-self-start">
                <Check size={16} /> Mark paid
              </Button>
            )}
          </Field>
        )}
      </form>
    </MiniSheet>
  );
}
