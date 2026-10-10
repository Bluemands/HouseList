"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Room } from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";
import { affordabilityIndex, buildPlan, compareForList, isOpen, roomStats } from "@/lib/plan";
import { formatGBP } from "@/lib/format";
import type { Route } from "@/lib/nav";
import { SwatchCard, PaintStrip } from "@/components/SwatchCard";
import { QuickAdd } from "@/components/QuickAdd";
import { ItemList, ItemRow } from "@/components/ItemRow";
import { SectionHead } from "@/components/ui";

export function RoomsView({ go }: { go: (r: Route) => void }) {
  const { items } = useStore();
  const stats = useMemo(() => roomStats(items), [items]);
  const active = stats.filter((s) => s.total > 0);
  const finished = active.filter((s) => s.open === 0).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <header className="pt-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-[-0.025em]">Rooms</h1>
        <p className="mt-0.5 text-[14px] text-ink-2">
          {active.length === 0
            ? "Every room gets its own paint. Tap one to start its list."
            : `${active.length} of ${stats.length} rooms on the go${finished ? ` · ${finished} all done` : ""}`}
        </p>
      </header>
      {/* Rooms with something in them get the full card; the rest wait in a
          compact fan below, still in deck order, so the busy rooms aren't
          buried in a long scroll of "Nothing yet". A fresh house shows the
          whole deck. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {(active.length ? active : stats).map((s) => (
          <SwatchCard key={s.room} stats={s} onOpen={() => go({ view: "rooms", room: s.room })} />
        ))}
      </div>
      {active.length > 0 && active.length < stats.length && (
        <section aria-labelledby="quiet-rooms-head" className="mt-2">
          <SectionHead id="quiet-rooms-head" title="Not started" />
          <ul className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 xl:grid-cols-4">
            {stats
              .filter((s) => s.total === 0)
              .map((s) => (
                <li key={s.room}>
                  <button
                    type="button"
                    onClick={() => go({ view: "rooms", room: s.room })}
                    className="flex w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface py-1.5 pr-3 pl-1.5 text-left transition-colors hover:border-line-strong"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 shrink-0 place-items-end rounded-[6px] p-1 text-[11px] leading-none font-semibold tabular shadow-[inset_0_0_0_1px_var(--chip-edge)]"
                      style={{ background: ROOM_PAINT[s.room].hex, color: ROOM_PAINT[s.room].ink }}
                    >
                      {ROOM_PAINT[s.room].number.replace("No. ", "")}
                    </span>
                    <span className="min-w-0 text-[14px] leading-tight font-medium text-ink">{ROOM_PAINT[s.room].label}</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function RoomView({ room, go }: { room: Room; go: (r: Route) => void }) {
  const { items, listing, listingSettings } = useStore();
  const [showDone, setShowDone] = useState(false);
  const paint = ROOM_PAINT[room];
  const stats = useMemo(() => roomStats(items).find((s) => s.room === room)!, [items, room]);
  const plan = useMemo(() => buildPlan(listing, listingSettings), [listing, listingSettings]);
  const afford = useMemo(() => affordabilityIndex(plan), [plan]);
  const roomItems = listing.filter((i) => i.room === room);
  const open = roomItems.filter(isOpen).sort(compareForList);
  const doing = open.filter((i) => i.status === "DOING");
  const todo = open.filter((i) => i.status !== "DOING");
  const done = roomItems.filter((i) => !isOpen(i));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <button
        type="button"
        onClick={() => go({ view: "rooms" })}
        className="inline-flex items-center gap-1 justify-self-start rounded-lg py-1 pr-2 text-[14px] font-semibold text-ink-2 hover:text-ink"
      >
        <ArrowLeft size={17} /> Rooms
      </button>

      <header
        className="-mx-4 grid gap-4 px-5 pt-6 pb-5 sm:mx-0 sm:rounded-[20px]"
        style={{ background: paint.hex, color: paint.ink }}
      >
        <h1 className="text-[32px] leading-none font-bold tracking-[-0.03em]">{paint.label}</h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          <Stat label="To do" value={String(stats.open)} />
          <Stat label="Done" value={String(stats.done)} />
          {stats.openCost > 0 && <Stat label="Still to spend" value={formatGBP(stats.openCost)} />}
          {stats.spent > 0 && <Stat label="Spent" value={formatGBP(stats.spent)} />}
        </dl>
        <div className="rounded-[4px] bg-surface/85 p-1.5">
          <PaintStrip stats={stats} tall />
        </div>
        <p className="text-[12px] font-semibold tabular">
          {paint.number} · {paint.paint}
        </p>
      </header>

      <QuickAdd defaultRoom={room} placeholder={`Add to the ${paint.label.toLowerCase()}…`} />

      {doing.length > 0 && (
        <section>
          <SectionHead title="In progress" />
          <ItemList>
            {doing.map((item) => (
              <ItemRow key={item.id} item={item} hideRoom monthsAway={afford.get(item.id)} />
            ))}
          </ItemList>
        </section>
      )}

      <section>
        <SectionHead title="To do" />
        {todo.length ? (
          <ItemList>
            {todo.map((item) => (
              <ItemRow key={item.id} item={item} hideRoom monthsAway={afford.get(item.id)} />
            ))}
          </ItemList>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-[14px] text-ink-2">
            {stats.total === 0 ? `Nothing for the ${paint.label.toLowerCase()} yet.` : "All done in here. Lovely."}
          </p>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            aria-expanded={showDone}
            className="px-1 py-2 text-[14px] font-semibold text-ink-2 hover:text-ink"
          >
            {showDone ? "Hide" : "Show"} {done.length} done
          </button>
          {showDone && (
            <ItemList className="mt-1">
              {done.map((item) => (
                <ItemRow key={item.id} item={item} hideRoom />
              ))}
            </ItemList>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] font-medium">{label}</dt>
      <dd className="text-[18px] font-bold tabular">{value}</dd>
    </div>
  );
}
