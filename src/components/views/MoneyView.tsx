"use client";

import { Fragment, useMemo, useState } from "react";
import clsx from "clsx";
import { Download, Pencil, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { buildPlan, roomStats, spending, type PlanEntry } from "@/lib/plan";
import { describeDay, formatGBP, formatGBPShort, formatMonth, today } from "@/lib/format";
import { ROOM_PAINT } from "@/lib/rooms";
import { ItemList, ItemRow } from "@/components/ItemRow";
import { Button, MoneyInput, PaintChip, SectionHead } from "@/components/ui";

export function MoneyView() {
  const { items, settings } = useStore();
  const plan = useMemo(() => buildPlan(items, settings), [items, settings]);
  const spend = useMemo(() => spending(items), [items]);
  const rooms = useMemo(
    () =>
      roomStats(items)
        .filter((r) => r.openCost > 0)
        .sort((a, b) => b.openCost - a.openCost),
    [items],
  );

  // Group the plan by when each thing becomes affordable.
  const groups = useMemo(() => {
    const out: { key: string; months: number | null; entries: PlanEntry[] }[] = [];
    for (const e of plan.entries) {
      const key = String(e.monthsAway);
      const last = out.at(-1);
      if (last && last.key === key) last.entries.push(e);
      else out.push({ key, months: e.monthsAway, entries: [e] });
    }
    return out;
  }, [plan]);
  const nowSpend = plan.entries.filter((e) => e.monthsAway === 0).reduce((s, e) => s + e.cost, 0);
  const leftAfterNow = plan.pot - nowSpend;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <header className="pt-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-[-0.025em]">Money</h1>
      </header>

      <PotPanel />

      <section aria-labelledby="plan-head">
        <SectionHead id="plan-head" title="The plan" />
        <p className="mb-3 max-w-[60ch] text-[14px] text-ink-2">
          Everything with a price, pinned things first and then by priority, paid from the pot until it runs out
          {plan.monthly > 0 ? `, then from ${formatGBP(plan.monthly)} a month of saving.` : "."} Ranges use the top
          figure, so it never under-promises.
        </p>

        {plan.entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-[14px] text-ink-2">
            Put a cost on a few things and the plan appears here.
          </p>
        ) : (
          <div className="grid gap-4">
            {groups.map((g, gi) => (
              <Fragment key={g.key}>
                {/* The cut line: where the pot runs dry. */}
                {plan.tracked && g.months !== 0 && (gi === 0 || groups[gi - 1].months === 0) && (
                  <CutLine left={gi === 0 ? plan.pot : leftAfterNow} next={g.entries[0]} saving={plan.monthly > 0} />
                )}
                <section>
                  <h3 className="mb-1.5 flex items-baseline justify-between px-1 text-[14px] font-bold text-ink">
                    {g.months === 0
                      ? "Affordable now"
                      : g.months === null
                        ? plan.tracked
                          ? "Not at current savings"
                          : "Set the pot above to plan these"
                        : `From ${formatMonth(g.months)}`}
                    <span className="text-[13px] font-medium text-ink-3 tabular">
                      {formatGBP(g.entries.reduce((s, e) => s + e.cost, 0))}
                    </span>
                  </h3>
                  <ItemList>
                    {g.entries.map((e) => (
                      <ItemRow key={e.item.id} item={e.item} />
                    ))}
                  </ItemList>
                </section>
              </Fragment>
            ))}
          </div>
        )}
      </section>

      {rooms.length > 0 && (
        <section aria-labelledby="rooms-money-head">
          <SectionHead id="rooms-money-head" title="Still to spend, by room" />
          <RoomBars rooms={rooms} />
        </section>
      )}

      <section aria-labelledby="spent-head">
        <SectionHead id="spent-head" title="Spent so far" />
        <div className="grid gap-4 rounded-2xl border border-line bg-surface p-4">
          {/* Nothing finished yet: a big £0 says nothing, the hint below says what to do. */}
          {spend.spent > 0 && (
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <div className="text-[28px] leading-tight font-bold tracking-[-0.02em] tabular">
                  {formatGBP(spend.spent)}
                </div>
                <div className="text-[13px] text-ink-2">
                  {spend.doneCount > 0 &&
                    `across ${spend.doneCount} finished ${spend.doneCount === 1 ? "thing" : "things"}`}
                  {spend.doneCount > 0 && spend.stagesPaid > 0 && ", "}
                  {spend.stagesPaid > 0 && `${formatGBP(spend.stagesPaid)} on stages of jobs still going`}
                </div>
              </div>
              {spend.estimateDelta !== null && spend.comparedCount >= 1 && (
                <p className="max-w-[28ch] text-right text-[13.5px] text-ink-2">
                  <span
                    className={clsx("font-semibold", spend.estimateDelta > 0.02 ? "text-danger" : "text-accent-text")}
                  >
                    {Math.abs(spend.estimateDelta) <= 0.02
                      ? "Bang on your estimates"
                      : `${Math.round(Math.abs(spend.estimateDelta) * 100)}% ${spend.estimateDelta > 0 ? "over" : "under"} estimates`}
                  </span>{" "}
                  so far
                </p>
              )}
            </div>
          )}
          <MonthBars months={spend.months} />
          <RecentSpend />
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-[14px] text-ink-2">Want it in a spreadsheet?</p>
        <a
          href="/api/export"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-sunken"
        >
          <Download size={16} /> Download CSV
        </a>
      </section>
    </div>
  );
}

/** Where the pot runs dry: what's left, and what it's saving towards. */
function CutLine({ left, next, saving }: { left: number; next: PlanEntry; saving: boolean }) {
  return (
    <div className="grid gap-1 py-1" role="separator" aria-label="The pot runs out here">
      <span className="border-t-2 border-dashed border-danger/60" />
      <span className="text-[13px] font-semibold text-danger tabular">
        {left < 0 ? `The pot is ${formatGBP(-left)} overdrawn` : `${formatGBP(left)} left in the pot`} —{" "}
        {saving
          ? `saving towards ${next.item.title} (${formatGBP(next.cost)})`
          : `${next.item.title} needs ${formatGBP(next.cost - Math.max(left, 0))} more. Set a monthly saving to see when.`}
      </span>
    </div>
  );
}

function PotPanel() {
  const { settings, saveSettings, toast, me } = useStore();
  const [editing, setEditing] = useState<"pot" | "monthly" | null>(null);
  const [value, setValue] = useState("");

  function start(field: "pot" | "monthly") {
    setValue(String(field === "pot" ? settings.budgetAvailable : settings.monthlySaving || ""));
    setEditing(field);
  }

  async function commit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(value.replace(/,/g, "") || 0);
    if (!Number.isFinite(n) || n < 0) return;
    const ok = await saveSettings(editing === "pot" ? { budgetAvailable: n } : { monthlySaving: n });
    if (ok) setEditing(null);
  }

  async function payday() {
    const amount = settings.monthlySaving;
    const previous = { lastPaydayOn: settings.lastPaydayOn, lastPaydayBy: settings.lastPaydayBy };
    const ok = await saveSettings({ addToPot: amount, lastPaydayOn: today(), lastPaydayBy: me });
    if (ok) {
      toast({
        message: `Added ${formatGBP(amount)} to the pot`,
        action: { label: "Undo", run: () => saveSettings({ addToPot: -amount, ...previous }) },
      });
    }
  }
  // Two phones, one pot: say when it last went in so it isn't added twice.
  const paidThisMonth = settings.lastPaydayOn?.slice(0, 7) === today().slice(0, 7);
  const lastPayday = settings.lastPaydayOn
    ? `${settings.lastPaydayBy === me ? "You" : (settings.lastPaydayBy ?? "Someone")} added it ${describeDay(settings.lastPaydayOn)}`
    : null;

  return (
    <section
      className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 sm:gap-6 sm:p-5"
      aria-label="The pot"
    >
      <div className="grid content-start gap-1">
        <span className="text-[13px] font-semibold text-ink-2">In the pot now</span>
        {editing === "pot" ? (
          <form onSubmit={commit} className="flex gap-2">
            <MoneyInput label="Money in the pot" value={value} onChange={setValue} />
            <Button type="submit">Save</Button>
          </form>
        ) : (
          <button type="button" onClick={() => start("pot")} className="group flex items-center gap-2 text-left">
            <span
              className={clsx(
                "text-[34px] leading-tight font-bold tracking-[-0.025em] tabular",
                settings.budgetAvailable < 0 && "text-danger",
              )}
            >
              {formatGBP(settings.budgetAvailable)}
            </span>
            <Pencil size={16} className="text-ink-3 group-hover:text-ink" aria-label="Edit" />
          </button>
        )}
        <span className="text-[12.5px] text-ink-3">
          {settings.potTracked
            ? "Paying for something takes it out automatically."
            : "Set what you have. From then on, ticking things off takes their cost out."}
        </span>
      </div>

      <div className="grid content-start gap-1">
        <span className="text-[13px] font-semibold text-ink-2">Saving each month</span>
        {editing === "monthly" ? (
          <form onSubmit={commit} className="flex gap-2">
            <MoneyInput label="Monthly saving" value={value} onChange={setValue} placeholder="0" />
            <Button type="submit">Save</Button>
          </form>
        ) : settings.monthlySaving ? (
          <button type="button" onClick={() => start("monthly")} className="group flex items-center gap-2 text-left">
            <span className="text-[22px] leading-tight font-bold tabular">{formatGBP(settings.monthlySaving)}</span>
            <Pencil size={15} className="text-ink-3 group-hover:text-ink" aria-label="Edit" />
          </button>
        ) : (
          // Not a value but the missing piece of the plan, so it reads as something to do.
          <>
            <Button
              variant="secondary"
              onClick={() => start("monthly")}
              className="mt-0.5 justify-self-start px-3 py-2"
            >
              <Plus size={15} /> Set a monthly saving
            </Button>
            <span className="text-[12.5px] text-ink-3">Then the plan can say when the rest becomes affordable.</span>
          </>
        )}
        {settings.monthlySaving > 0 && editing !== "monthly" && (
          <>
            <Button variant="secondary" onClick={payday} className="mt-1.5 justify-self-start px-3 py-2">
              <Plus size={15} /> {paidThisMonth ? "Add" : "Payday: add"} {formatGBP(settings.monthlySaving)}
              {paidThisMonth && " again"}
            </Button>
            {lastPayday && (
              <span className={clsx("text-[12.5px]", paidThisMonth ? "font-semibold text-ink-2" : "text-ink-3")}>
                {lastPayday}
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** Horizontal bars, one per room, coloured by the room's own paint and named. */
function RoomBars({ rooms }: { rooms: ReturnType<typeof roomStats> }) {
  const max = Math.max(...rooms.map((r) => r.openCost));
  return (
    <ul className="grid gap-2.5 rounded-2xl border border-line bg-surface p-4">
      {rooms.map((r) => (
        <li key={r.room} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-[13.5px]">
          <span className="truncate text-ink-2">{ROOM_PAINT[r.room].label}</span>
          <span className="h-3 overflow-hidden" title={`${ROOM_PAINT[r.room].label}: ${formatGBP(r.openCost)}`}>
            <span
              className="block h-full rounded-r-[4px] transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(2, (r.openCost / max) * 100)}%`, background: ROOM_PAINT[r.room].hex }}
            />
          </span>
          <span className="font-semibold text-ink tabular">{formatGBP(r.openCost)}</span>
        </li>
      ))}
    </ul>
  );
}

const monthName = (key: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date(`${key}-01T00:00:00`));

/** Six months of spending as thin columns, with the value on hover/focus. */
function MonthBars({ months }: { months: { key: string; total: number }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...months.map((m) => m.total));
  // One month of data is a number, not a trend.
  if (months.filter((m) => m.total > 0).length < 2) return null;
  return (
    <figure>
      <div className="flex h-28 items-end gap-2" onMouseLeave={() => setHover(null)}>
        {months.map((m) => (
          <button
            key={m.key}
            type="button"
            onMouseEnter={() => setHover(m.key)}
            onFocus={() => setHover(m.key)}
            onBlur={() => setHover(null)}
            aria-label={`${monthName(m.key)}: ${formatGBP(m.total)}`}
            className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
          >
            {hover === m.key && m.total > 0 && (
              <span className="absolute -top-1 z-10 -translate-y-full rounded-md bg-ink px-2 py-1 text-[12px] font-semibold whitespace-nowrap text-bg tabular shadow-pop">
                {formatGBP(m.total)}
              </span>
            )}
            <span
              className={clsx(
                "w-full max-w-9 rounded-t-[4px] transition-[height,background-color] duration-500 ease-out",
                hover === m.key ? "bg-accent-hover" : "bg-accent",
              )}
              style={{
                height: m.total > 0 ? `${Math.max(4, (m.total / max) * 100)}%` : "2px",
                opacity: m.total > 0 ? 1 : 0.35,
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 border-t border-line pt-1.5">
        {months.map((m) => (
          <span key={m.key} className="flex-1 text-center text-[12px] text-ink-3">
            {monthName(m.key)}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        Spending by month: {months.map((m) => `${monthName(m.key)} ${formatGBPShort(m.total)}`).join(", ")}
      </figcaption>
    </figure>
  );
}

/** The last few things paid for, so the total has receipts behind it. */
function RecentSpend() {
  const { items } = useStore();
  const recent = items
    .filter((i) => i.status === "DONE" && i.completedAt && (i.actualPrice ?? i.estimatedPrice))
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1))
    .slice(0, 5);
  if (!recent.length) {
    return <p className="text-[13.5px] text-ink-3">Tick off something with a cost and it shows up here.</p>;
  }
  return (
    <ul className="grid gap-2 border-t border-line pt-3">
      {recent.map((i) => (
        <li key={i.id} className="flex items-center gap-2.5 text-[14px]">
          <PaintChip room={i.room} />
          <span className="min-w-0 flex-1 truncate text-ink">{i.title}</span>
          <span className="shrink-0 text-ink-3 tabular">{formatGBP(i.actualPrice ?? i.estimatedPrice ?? 0)}</span>
        </li>
      ))}
    </ul>
  );
}
