"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Search, ShoppingCart, SlidersHorizontal, X } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  ROOMS,
  type ItemDTO,
  type Kind,
  type Priority,
  type Room,
} from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";
import { affordabilityIndex, buildPlan, compareForList, isOpen, matchesSearch, planCost } from "@/lib/plan";
import { formatGBP, today } from "@/lib/format";
import { QuickAdd } from "@/components/QuickAdd";
import { ItemList, ItemRow } from "@/components/ItemRow";
import { Chip, PaintChip, Segmented } from "@/components/ui";
import { SelectionBar } from "@/components/SelectionBar";
import { Supplies, type Supply } from "@/components/Supplies";
import { isShoppingStep } from "@/lib/parse";

type GroupBy = "room" | "priority" | "due" | "who" | "project";
type KindFilter = "ALL" | Kind;

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: "room", label: "Room" },
  { value: "priority", label: "Priority" },
  { value: "due", label: "When" },
  { value: "who", label: "Who" },
  { value: "project", label: "Project" },
];

function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  return [
    value,
    (v: T) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {}
    },
  ];
}

function dueBucket(item: ItemDTO): { key: string; label: string; order: number } {
  if (!item.dueDate) return { key: "none", label: "No date", order: 9 };
  const t = today();
  if (item.dueDate < t) return { key: "late", label: "Overdue", order: 0 };
  const diff = Math.round((Date.parse(item.dueDate) - Date.parse(t)) / 86_400_000);
  if (diff === 0) return { key: "today", label: "Today", order: 1 };
  if (diff <= 7) return { key: "week", label: "This week", order: 2 };
  if (diff <= 31) return { key: "month", label: "This month", order: 3 };
  return { key: "later", label: "Later", order: 4 };
}

export function ListView() {
  const { items, listing, listingSettings } = useStore();
  const [query, setQuery] = useState("");
  const [kind, setKind] = usePersisted<KindFilter>("hl-kind", "ALL");
  const [groupBy, setGroupBy] = usePersisted<GroupBy>("hl-group", "room");
  const [showFilters, setShowFilters] = useState(false);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [who, setWho] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [trip, setTrip] = useState(false);
  // Selecting several to act on at once; ids, so a poll doesn't drop them.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelecting(false);
      setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);

  const plan = useMemo(() => buildPlan(listing, listingSettings), [listing, listingSettings]);
  const afford = useMemo(() => affordabilityIndex(plan), [plan]);

  const people = useMemo(
    () => [...new Set(items.map((i) => i.assignee).filter((a): a is string => !!a))].sort(),
    [items],
  );

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      listing.filter((i) => {
        if (kind !== "ALL" && i.kind !== kind) return false;
        if (priorities.length && !priorities.includes(i.priority)) return false;
        if (rooms.length && !rooms.includes(i.room)) return false;
        if (who && i.assignee !== who) return false;
        // A shopping trip only shows what the pot can cover right now (everything, until there's a pot).
        if (trip && (i.kind !== "BUY" || (plan.tracked && isOpen(i) && afford.get(i.id) !== 0 && planCost(i) > 0))) {
          return false;
        }
        return matchesSearch(i, q);
      }),
    [listing, kind, priorities, rooms, who, trip, q, afford, plan.tracked],
  );

  const open = matches.filter(isOpen).sort(compareForList);
  const done = matches
    .filter((i) => !isOpen(i))
    .sort((a, b) => ((a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1));
  const tripDone = trip ? done.filter((i) => i.completedAt && i.completedAt.slice(0, 10) === today()) : [];

  // Shopping inside jobs ("Buy faceplates" under "Fit sockets") belongs in To buy too.
  const supplies = useMemo<Supply[]>(() => {
    if (kind !== "BUY") return [];
    return listing
      .filter((item) => isOpen(item) && (!rooms.length || rooms.includes(item.room)) && (!who || item.assignee === who))
      .flatMap((item) => item.steps.filter((step) => !step.done && isShoppingStep(step)).map((step) => ({ item, step })))
      .filter(({ item, step }) => !q || `${step.text} ${item.title}`.toLowerCase().includes(q));
  }, [kind, listing, rooms, who, q]);
  const tripSupplies = trip
    ? listing.flatMap((i) => i.steps.filter((s) => s.done && s.doneAt?.slice(0, 10) === today() && isShoppingStep(s)))
    : [];

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: React.ReactNode; order: number; items: ItemDTO[] }>();
    for (const item of open) {
      let key: string, label: React.ReactNode, order: number;
      switch (groupBy) {
        case "priority":
          key = item.priority;
          label = PRIORITY_LABELS[item.priority];
          order = PRIORITY_ORDER[item.priority];
          break;
        case "due": {
          const b = dueBucket(item);
          ({ key, label, order } = b);
          break;
        }
        case "who":
          key = item.assignee ?? "";
          label = item.assignee ?? "Nobody yet";
          order = item.assignee ? 0 : 1;
          break;
        case "project":
          key = item.project ?? "";
          label = item.project ?? "No project";
          order = item.project ? 0 : 1;
          break;
        default:
          key = item.room;
          label = (
            <span className="inline-flex items-center gap-2">
              <PaintChip room={item.room} />
              {ROOM_PAINT[item.room].label}
            </span>
          );
          order = ROOMS.indexOf(item.room);
      }
      if (!map.has(key)) map.set(key, { key, label, order, items: [] });
      map.get(key)!.items.push(item);
    }
    return [...map.values()].sort((a, b) => a.order - b.order || String(a.key).localeCompare(String(b.key)));
  }, [open, groupBy]);

  const filterCount = priorities.length + rooms.length + (who ? 1 : 0);
  const kindCounts = {
    ALL: items.filter(isOpen).length,
    TASK: items.filter((i) => isOpen(i) && i.kind === "TASK").length,
    BUY: items.filter((i) => isOpen(i) && i.kind === "BUY").length,
  };
  const openTotal = open.reduce((s, i) => s + planCost(i), 0);
  const tripSpent =
    tripDone.reduce((s, i) => s + (i.actualPrice ?? i.estimatedPrice ?? 0), 0) +
    tripSupplies.reduce((s, st) => s + (st.cost ?? 0), 0);
  const selectedItems = open.filter((i) => selected.has(i.id));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <header className="flex items-end justify-between gap-3 pt-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-[-0.025em]">Everything</h1>
        <div className="flex items-center gap-3 pb-1">
          <p className="text-[14px] text-ink-2 tabular">
            {open.length} open{openTotal > 0 && <> · {formatGBP(openTotal)}</>}
          </p>
          {open.length > 1 && !selecting && (
            <button
              type="button"
              onClick={() => setSelecting(true)}
              className="rounded-lg px-2 py-1 text-[14px] font-semibold text-accent-text hover:bg-sunken"
            >
              Select
            </button>
          )}
        </div>
      </header>

      <QuickAdd defaultKind={kind === "ALL" ? undefined : kind} />

      {/* Toolbar stays pinned while the list scrolls under it. */}
      <div className="sticky top-0 z-20 -mx-4 grid gap-2.5 bg-bg px-4 pt-2 pb-2.5 sm:-mx-6 sm:px-6 lg:-mx-2 lg:px-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search everything"
              className="w-full rounded-[10px] border border-line bg-surface py-2 pr-3 pl-9 text-[15px] outline-none placeholder:text-ink-3 focus:border-accent"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
            aria-label={filterCount ? `Filters, ${filterCount} on` : "Filters"}
            className={clsx(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] border px-3 text-[14px] font-semibold transition-colors",
              showFilters || filterCount
                ? "border-accent bg-accent-soft text-accent-text"
                : "border-line bg-surface text-ink-2 hover:text-ink",
            )}
          >
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filter</span>
            {filterCount > 0 && <span className="tabular">{filterCount}</span>}
          </button>
        </div>
        <Segmented
          label="Show"
          value={kind}
          onChange={(v) => {
            setKind(v);
            if (v !== "BUY") setTrip(false);
          }}
          options={[
            {
              value: "ALL",
              label: (
                <>
                  All <span className="text-ink-3 tabular">{kindCounts.ALL}</span>
                </>
              ),
            },
            {
              value: "TASK",
              label: (
                <>
                  Jobs <span className="text-ink-3 tabular">{kindCounts.TASK}</span>
                </>
              ),
            },
            {
              value: "BUY",
              label: (
                <>
                  To buy <span className="text-ink-3 tabular">{kindCounts.BUY}</span>
                </>
              ),
            },
          ]}
        />
      </div>

      {showFilters && (
        <div className="grid gap-3.5 rounded-2xl border border-line bg-surface p-4">
          <FilterRow label="Group by">
            {GROUPS.map((g) => (
              <Chip key={g.value} selected={groupBy === g.value} onClick={() => setGroupBy(g.value)}>
                {g.label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Priority">
            {PRIORITIES.map((p) => (
              <Chip
                key={p}
                selected={priorities.includes(p)}
                onClick={() => setPriorities((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]))}
              >
                {PRIORITY_LABELS[p]}
              </Chip>
            ))}
          </FilterRow>
          {people.length > 0 && (
            <FilterRow label="Who">
              {people.map((p) => (
                <Chip key={p} selected={who === p} onClick={() => setWho(who === p ? null : p)}>
                  {p}
                </Chip>
              ))}
            </FilterRow>
          )}
          <FilterRow label="Rooms" scroll>
            {ROOMS.map((r) => (
              <Chip
                key={r}
                selected={rooms.includes(r)}
                onClick={() => setRooms((list) => (list.includes(r) ? list.filter((x) => x !== r) : [...list, r]))}
              >
                <PaintChip room={r} />
                {ROOM_PAINT[r].label}
              </Chip>
            ))}
          </FilterRow>
          {filterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setPriorities([]);
                setRooms([]);
                setWho(null);
              }}
              className="justify-self-start text-[14px] font-semibold text-accent-text hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {kind === "BUY" && (
        <div
          className={clsx(
            "flex items-center gap-3 rounded-2xl border p-3.5 transition-colors",
            trip ? "border-accent bg-accent-soft" : "border-line bg-surface",
          )}
        >
          <ShoppingCart size={20} className={trip ? "text-accent-text" : "text-ink-2"} aria-hidden="true" />
          <div className="min-w-0 flex-1 text-[14px]">
            {trip ? (
              <>
                <div className="font-semibold text-ink">On a shopping trip</div>
                <div className="text-ink-2 tabular">
                  {plan.tracked ? "Showing what the pot covers. " : ""}Bought today:{" "}
                  {tripDone.length + tripSupplies.length} · {formatGBP(tripSpent)}
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold text-ink">Out shopping?</div>
                <div className="text-ink-2">
                  {plan.tracked ? "Only show what you can afford right now, and tick" : "Tick"} things off as you go,
                  supplies for jobs included.
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTrip((t) => !t)}
            className={clsx(
              "shrink-0 rounded-[10px] px-3 py-2 text-[14px] font-semibold",
              trip ? "text-accent-text hover:bg-surface/60" : "bg-accent text-accent-ink hover:bg-accent-hover",
            )}
          >
            {trip ? "End trip" : "Start"}
          </button>
        </div>
      )}

      {open.length === 0 && !supplies.length && (
        <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
          <p className="text-[16px] font-semibold text-ink">
            {q || filterCount
              ? "Nothing matches"
              : trip
                ? "Nothing to buy fits the pot right now"
                : "Nothing open here"}
          </p>
          <p className="mt-1 text-[14px] text-ink-2">
            {q || filterCount ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setPriorities([]);
                  setRooms([]);
                  setWho(null);
                }}
                className="font-semibold text-accent-text hover:underline"
              >
                Clear search and filters
              </button>
            ) : trip ? (
              kindCounts.BUY > 0 ? (
                <>
                  The pot&apos;s already spoken for by higher priorities.{" "}
                  <button
                    type="button"
                    onClick={() => setTrip(false)}
                    className="font-semibold text-accent-text hover:underline"
                  >
                    See everything to buy
                  </button>
                </>
              ) : (
                "Nothing on the list to buy."
              )
            ) : (
              "Add something with the box above."
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        {groups.map((group) => {
          const subtotal = group.items.reduce((s, i) => s + planCost(i), 0);
          return (
            <section key={group.key} aria-label={typeof group.label === "string" ? group.label : undefined}>
              {/* Sticky header names the group you're scrolled into. */}
              <h2 className="sticky top-[104px] z-[15] -mx-1 flex items-center justify-between bg-bg px-1 py-2 text-[14px] font-bold text-ink">
                {group.label}
                <span className="text-[13px] font-medium text-ink-3 tabular">
                  {group.items.length}
                  {subtotal > 0 && <> · {formatGBP(subtotal)}</>}
                </span>
              </h2>
              <ItemList>
                {group.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    hideRoom={groupBy === "room"}
                    monthsAway={item.kind === "BUY" || planCost(item) > 0 ? afford.get(item.id) : undefined}
                    select={
                      selecting
                        ? {
                            selected: selected.has(item.id),
                            onToggle: () =>
                              setSelected((set) => {
                                const next = new Set(set);
                                if (!next.delete(item.id)) next.add(item.id);
                                return next;
                              }),
                          }
                        : undefined
                    }
                  />
                ))}
              </ItemList>
            </section>
          );
        })}
      </div>

      {!selecting && <Supplies supplies={supplies} />}

      {done.length > 0 && !selecting && (
        <section>
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            aria-expanded={showDone}
            className="flex w-full items-center justify-between rounded-[10px] px-1 py-2 text-[14px] font-semibold text-ink-2 hover:text-ink"
          >
            <span>
              {showDone ? "Hide" : "Show"} {done.length} done
            </span>
            {showDone ? <X size={16} /> : null}
          </button>
          {showDone && (
            <ItemList className="mt-1">
              {done.slice(0, 200).map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ItemList>
          )}
        </section>
      )}
      {selecting && (
        <>
          {/* Room to scroll the last rows clear of the bar. */}
          <div aria-hidden="true" className="h-20" />
          <SelectionBar
            selected={selectedItems}
            total={open.length}
            onToggleAll={() =>
              setSelected(selectedItems.length === open.length ? new Set() : new Set(open.map((i) => i.id)))
            }
            onExit={stopSelecting}
          />
        </>
      )}
    </div>
  );
}

function FilterRow({ label, children, scroll }: { label: string; children: React.ReactNode; scroll?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      <div className={clsx("flex gap-1.5", scroll ? "rail -mx-4 overflow-x-auto px-4" : "flex-wrap")}>{children}</div>
    </div>
  );
}
