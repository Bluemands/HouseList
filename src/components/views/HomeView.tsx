"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronRight, Settings, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { affordabilityIndex, buildPlan, roomStats, upNext } from "@/lib/plan";
import { dayDiff, formatGBP, formatMonth, greeting, timeAgo, today } from "@/lib/format";
import { ROOM_PAINT } from "@/lib/rooms";
import { ESSENTIALS } from "@/lib/essentials";
import { PaintFan } from "@/components/Wordmark";
import type { Route } from "@/lib/nav";
import { QuickAdd } from "@/components/QuickAdd";
import { SinceLastTime } from "@/components/SinceLastTime";
import { ItemList, ItemRow } from "@/components/ItemRow";
import { SwatchCard } from "@/components/SwatchCard";
import { PaintChip, SectionHead } from "@/components/ui";

export function HomeView({ go, onSettings }: { go: (r: Route) => void; onSettings: () => void }) {
  const { items, listing, listingSettings, settings, me, openBulk } = useStore();
  // The money strip is always live; Up next is ordered from the listing so a
  // tick doesn't reshuffle it mid-animation.
  const plan = useMemo(() => buildPlan(items, settings), [items, settings]);
  const afford = useMemo(() => affordabilityIndex(buildPlan(listing, listingSettings)), [listing, listingSettings]);
  const next = useMemo(() => upNext(listing, me, afford, 5), [listing, me, afford]);
  const rooms = useMemo(() => roomStats(items), [items]);
  const openCount = items.filter((i) => i.status !== "DONE").length;
  const recent = useMemo(
    () =>
      items
        .filter((i) => i.status === "DONE" && i.completedAt)
        .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1))
        .slice(0, 4),
    [items],
  );

  // Only rooms with something in them; the rest are a tap away under "All rooms".
  const deck = rooms.filter((r) => r.total > 0).sort((a, b) => b.open - a.open);
  // Done since Monday — a small, honest sense of momentum.
  const doneThisWeek = useMemo(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    return items.filter((i) => i.completedAt && new Date(i.completedAt) >= monday).length;
  }, [items]);
  const openEssentials = () =>
    openBulk({
      title: "New-home essentials",
      intro: "The jobs most people get round to in the first few months. Untick anything you've done or don't need.",
      candidates: ESSENTIALS,
    });
  const dayInHouse = settings.movedInOn ? dayDiff(settings.movedInOn, today()) + 1 : null;
  const dateLine = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.025em] text-ink">
            {greeting()}, {me}
          </h1>
          <p className="mt-0.5 text-[14px] text-ink-2">
            {dateLine}
            {dayInHouse && dayInHouse > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-ink">Day {dayInHouse}</span> in the house
              </>
            )}
            {doneThisWeek > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-accent-text">{doneThisWeek} done</span> this week
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onSettings}
          aria-label="Settings"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink lg:hidden"
        >
          <Settings size={20} />
        </button>
      </header>

      <SinceLastTime />

      <QuickAdd />

      <MoneyStrip plan={plan} onOpen={() => go({ view: "money" })} />

      <section aria-labelledby="next-head">
        <SectionHead id="next-head" title="Up next">
          {openCount > 0 && (
            <button
              type="button"
              onClick={() => go({ view: "list" })}
              className="inline-flex items-center gap-0.5 text-[14px] font-semibold text-accent-text hover:underline"
            >
              All {openCount} <ChevronRight size={16} />
            </button>
          )}
        </SectionHead>
        {next.length ? (
          <ItemList>
            {next.map((item, i) => (
              <ItemRow key={item.id} item={item} lead={i === 0} monthsAway={afford.get(item.id)} />
            ))}
          </ItemList>
        ) : (
          <EmptyNext hasItems={items.length > 0} onEssentials={openEssentials} />
        )}
        {items.length > 0 && items.length < 25 && <EssentialsNudge onOpen={openEssentials} />}
      </section>

      {deck.length > 0 && (
        <section aria-labelledby="rooms-head">
          <SectionHead id="rooms-head" title="Rooms">
            <button
              type="button"
              onClick={() => go({ view: "rooms" })}
              className="inline-flex items-center gap-0.5 text-[14px] font-semibold text-accent-text hover:underline"
            >
              All rooms <ChevronRight size={16} />
            </button>
          </SectionHead>
          <div className="rail -mx-4 flex gap-2.5 overflow-x-auto px-4 pt-1 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
            {deck.map((stats, i) => (
              <div key={stats.room} className={clsx("contents", i >= 8 && "lg:hidden")}>
                <SwatchCard stats={stats} compact onOpen={() => go({ view: "rooms", room: stats.room })} />
              </div>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent-head">
          <SectionHead id="recent-head" title="Recently done" />
          <ul className="grid gap-2.5">
            {recent.map((item) => (
              <li key={item.id} className="flex items-center gap-2.5 text-[14px]">
                <PaintChip room={item.room} />
                <span className="min-w-0 flex-1 truncate text-ink-2">
                  <span className="font-semibold text-ink">{item.completedBy ?? "Someone"}</span>{" "}
                  {item.kind === "BUY" ? "bought" : "finished"} {item.title}
                </span>
                <span className="shrink-0 text-[12.5px] text-ink-3">{timeAgo(item.completedAt!)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MoneyStrip({ plan, onOpen }: { plan: ReturnType<typeof buildPlan>; onOpen: () => void }) {
  // Before anyone sets the pot, "£0 · £160 short" is noise: invite it instead.
  if (!plan.tracked) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:border-line-strong"
      >
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-[15px] font-semibold text-ink">Set up the pot</span>
          <span className="text-[13px] text-ink-2">
            {plan.openTotal > 0
              ? `${formatGBP(plan.openTotal)} of costs on the list. Say what you have to see what's affordable.`
              : "Say what you have to spend, and the plan shows what it covers."}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
      </button>
    );
  }
  const short = plan.mustSpare < 0;
  // How much of the must-haves the pot already covers.
  const covered = plan.mustTotal > 0 ? Math.min(100, (Math.max(plan.pot, 0) / plan.mustTotal) * 100) : 100;

  let status: string;
  if (short) status = `${formatGBP(-plan.mustSpare)} short for must-haves`;
  else if (plan.mustTotal > 0) status = `${formatGBP(plan.mustSpare)} spare after must-haves`;
  else if (plan.openTotal > 0) status = "No must-haves waiting";
  else status = "Add costs to see the plan";

  let when: string | null = null;
  if (plan.openTotal > 0) {
    if (plan.allClearIn === 0) when = "Everything affordable now";
    else if (plan.allClearIn === null) when = "Set a monthly saving to see when the rest is affordable";
    else when = `All clear by ${formatMonth(plan.allClearIn)}`;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid gap-2 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:border-line-strong"
    >
      <span className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap">
        <span className="text-[17px] font-bold text-ink tabular">
          {formatGBP(plan.pot)} <span className="font-medium text-ink-2">in the pot</span>
        </span>
        <span className={clsx("text-[14px] font-semibold tabular", short ? "text-danger" : "text-accent-text")}>
          {status}
        </span>
        <ChevronRight size={18} className="ml-auto self-center text-ink-3 transition-transform group-hover:translate-x-0.5" />
      </span>
      {plan.mustTotal > 0 && (
        <span className="flex h-1.5 gap-[2px]" aria-hidden="true">
          <span className="rounded-full bg-accent transition-[flex-grow] duration-500 ease-out" style={{ flexGrow: covered }} />
          {covered < 100 && <span className="rounded-full bg-line" style={{ flexGrow: 100 - covered }} />}
        </span>
      )}
      {when && (
        <span className="text-[12.5px] text-ink-3">
          {plan.mustTotal > 0 && <>Must-haves {formatGBP(plan.mustTotal)} · </>}
          {when}
        </span>
      )}
    </button>
  );
}

/** A quiet offer of the starter checklist while the list is still young. */
function EssentialsNudge({ onOpen }: { onOpen: () => void }) {
  const { items } = useStore();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem("hl-essentials-dismissed") === "1";
    } catch {
      return false;
    }
  });
  const titles = new Set(items.map((i) => i.title.toLowerCase()));
  const missing = ESSENTIALS.filter((e) => !titles.has(e.title.toLowerCase())).length;
  if (dismissed || missing < 4) return null;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-line-strong px-3.5 py-3">
      <PaintFan size={26} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block text-[14px] font-semibold text-ink">Just moved in?</span>
        <span className="block text-[13px] text-ink-2">
          Browse {missing} jobs most people do in the first few months: locks, stopcock, meters…
        </span>
      </button>
      <button
        type="button"
        aria-label="Hide this suggestion"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem("hl-essentials-dismissed", "1");
          } catch {}
        }}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function EmptyNext({ hasItems, onEssentials }: { hasItems: boolean; onEssentials: () => void }) {
  const swatches = ["KITCHEN", "GAMES_ROOM", "SPARE_ROOM_2", "BATHROOM_2", "LANDING"] as const;
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-9 text-center">
      <div className="flex items-end gap-1" aria-hidden="true">
        {swatches.map((room, i) => (
          <span
            key={room}
            className="paint-in w-4 rounded-[3px]"
            style={{ background: ROOM_PAINT[room].hex, height: [26, 38, 22, 32, 18][i], animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
      <p className="text-[16px] font-semibold text-ink">{hasItems ? "All caught up" : "A blank canvas"}</p>
      <p className="max-w-[34ch] text-[14px] text-ink-2">
        {hasItems
          ? "Nothing left to do. Put the kettle on, or add the next thing above."
          : "Add the first job or thing to buy above. Every room fills in with its paint colour as you go."}
      </p>
      {!hasItems && (
        <button
          type="button"
          onClick={onEssentials}
          className="mt-1 rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
        >
          Start with the new-home essentials
        </button>
      )}
    </div>
  );
}
