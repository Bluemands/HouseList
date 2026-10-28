"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, dayDiff, today } from "@/lib/format";
import { ROOM_PAINT } from "@/lib/rooms";
import { binNames } from "@/lib/bins";
import {
  EVENT_REPEATS,
  EVENT_REPEAT_LABELS,
  EVENT_TITLE_MAX,
  addMonth,
  calendarDays,
  formatTime,
  monthGrid,
  type CalEntry,
  type EventDTO,
  type EventRepeat,
} from "@/lib/events";
import { MiniSheet } from "@/components/MiniSheet";
import { EntryMark } from "@/components/ComingUp";
import { Button, Chip, Field, GrowingTextarea, inputClass } from "@/components/ui";

// The calendar: a month at a glance, what's on the day you pick, and your
// own events to add or change. Jobs open as themselves.

const at = (day: string) => new Date(`${day}T12:00:00`);
const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const longDay = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const shortDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

type Editing = { id: string | null; date: string };

export function CalendarSheet({ day, leaving, onClose }: { day: string; leaving: boolean; onClose: () => void }) {
  const { events } = useStore();
  const [selected, setSelected] = useState(day);
  const [month, setMonth] = useState(day.slice(0, 7));
  const [editing, setEditing] = useState<Editing | null>(null);
  const event = editing?.id ? events.find((e) => e.id === editing.id) : undefined;

  const pick = (next: string) => {
    setSelected(next);
    setMonth(next.slice(0, 7));
  };

  return (
    <MiniSheet
      title={editing ? (event ? "Event" : "Add to the calendar") : "Calendar"}
      leaving={leaving}
      onClose={onClose}
    >
      {editing ? (
        <>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="-ml-1 inline-flex items-center gap-0.5 justify-self-start text-supporting font-semibold text-accent-text hover:underline"
          >
            <ChevronLeft size={17} /> Calendar
          </button>
          <EventForm
            key={editing.id ?? `new:${editing.date}`}
            event={event}
            date={editing.date}
            onDone={(date) => {
              if (date) pick(date);
              setEditing(null);
            }}
          />
        </>
      ) : (
        <>
          <Month month={month} selected={selected} onMonth={setMonth} onPick={pick} />
          <Day
            day={selected}
            onEdit={(id) => setEditing({ id, date: selected })}
            onAdd={() => setEditing({ id: null, date: selected })}
            onOpenItem={onClose}
          />
        </>
      )}
    </MiniSheet>
  );
}

function Month({
  month,
  selected,
  onMonth,
  onPick,
}: {
  month: string;
  selected: string;
  onMonth: (month: string) => void;
  onPick: (day: string) => void;
}) {
  const { events, items, settings } = useStore();
  const now = today();
  const weeks = useMemo(() => monthGrid(month), [month]);
  const days = useMemo(
    () => calendarDays({ events, items, bins: settings.bins }, weeks[0][0], weeks.at(-1)!.at(-1)!),
    [events, items, settings.bins, weeks],
  );
  // A sideways swipe across the month turns the page.
  const swipe = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1">
        <h3 className="min-w-0 flex-1 text-body font-semibold text-ink" aria-live="polite">
          {monthLabel.format(at(`${month}-01`))}
        </h3>
        {(month !== now.slice(0, 7) || selected !== now) && (
          <Button variant="ghost" onClick={() => onPick(now)} className="px-3 py-1.5 text-meta">
            Today
          </Button>
        )}
        <button
          type="button"
          onClick={() => onMonth(addMonth(month, -1))}
          aria-label="Previous month"
          className="hit grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <ChevronLeft size={19} />
        </button>
        <button
          type="button"
          onClick={() => onMonth(addMonth(month, 1))}
          aria-label="Next month"
          className="hit -mr-2 grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <ChevronRight size={19} />
        </button>
      </div>
      <div
        className="grid grid-cols-7 gap-y-0.5"
        onTouchStart={(e) => (swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const from = swipe.current;
          swipe.current = null;
          if (!from) return;
          const dx = e.changedTouches[0].clientX - from.x;
          const dy = e.changedTouches[0].clientY - from.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) onMonth(addMonth(month, dx < 0 ? 1 : -1));
        }}
      >
        {WEEKDAYS.map((d, i) => (
          <span key={i} aria-hidden="true" className="pb-1 text-center text-label font-semibold text-ink-3">
            {d}
          </span>
        ))}
        {weeks.flat().map((day) => {
          const entries = days.get(day) ?? [];
          const inMonth = day.slice(0, 7) === month;
          const isSelected = day === selected;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onPick(day)}
              aria-pressed={isSelected}
              aria-label={`${longDay.format(at(day))}${entries.length ? `, ${entries.length} on` : ""}`}
              className="flex h-12 flex-col items-center gap-1 rounded-control pt-1 transition-colors hover:bg-sunken"
            >
              <span
                className={clsx(
                  "grid h-7 w-7 place-items-center rounded-full text-supporting tabular",
                  isSelected
                    ? "bg-accent font-semibold text-accent-ink"
                    : day === now
                      ? "font-bold text-accent-text"
                      : inMonth
                        ? "text-ink"
                        : "text-ink-3",
                )}
              >
                {Number(day.slice(8))}
              </span>
              <span aria-hidden="true" className="flex h-1.5 gap-0.5">
                {entries.slice(0, 3).map((e, i) => (
                  <span
                    key={i}
                    className={clsx("h-1.5 w-1.5 rounded-full", e.kind === "event" && "bg-ink", !inMonth && "opacity-50")}
                    style={e.kind === "item" ? { background: ROOM_PAINT[e.item.room].hex } : e.kind === "bins" ? { background: e.bins[0].colour } : undefined}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** What's on one day: events to change, jobs to open, bins to put out. */
function Day({
  day,
  onEdit,
  onAdd,
  onOpenItem,
}: {
  day: string;
  onEdit: (id: string) => void;
  onAdd: () => void;
  onOpenItem: () => void;
}) {
  const { events, items, settings, openItem } = useStore();
  const entries = useMemo(
    () => calendarDays({ events, items, bins: settings.bins }, day, day).get(day) ?? [],
    [events, items, settings.bins, day],
  );

  return (
    <section aria-label={longDay.format(at(day))} className="grid gap-2 border-t border-line pt-3">
      <h3 className="text-meta font-semibold text-ink-2">{longDay.format(at(day))}</h3>
      {entries.length ? (
        <ul className="grid grid-cols-[minmax(0,1fr)]">
          {entries.map((e) => (
            <li key={key(e)}>
              {e.kind === "bins" ? (
                <div className="flex items-center gap-2.5 py-2">
                  <span aria-hidden="true" className="flex shrink-0 -space-x-1">
                    {e.bins.map((b) => (
                      <span key={b.id} className="h-2.5 w-2.5 rounded-full ring-2 ring-surface" style={{ background: b.colour }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body text-ink-2">Bins: {binNames(e.bins)}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (e.kind === "event") return onEdit(e.event.id);
                    onOpenItem();
                    openItem(e.item.id);
                  }}
                  className="flex w-full items-center gap-2.5 py-2 text-left hover:text-accent-text"
                >
                  <EntryMark entry={e} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-ink">
                      {e.kind === "event" ? e.event.title : e.item.title}
                    </span>
                    <span className="block truncate text-meta text-ink-3">{describe(e, day)}</span>
                  </span>
                  {e.kind === "event" && e.event.time && (
                    <span className="shrink-0 text-supporting text-ink-2 tabular">{formatTime(e.event.time)}</span>
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-supporting text-ink-3">Nothing on.</p>
      )}
      <Button variant="secondary" onClick={onAdd} className="justify-self-start">
        <Plus size={16} /> Add on {shortDay.format(at(day))}
      </Button>
    </section>
  );
}

const key = (e: CalEntry) => (e.kind === "event" ? `e:${e.event.id}` : e.kind === "item" ? `i:${e.item.id}` : "bins");

/** The line under an entry: how long it runs, how often, or which room's job it is. */
function describe(e: Exclude<CalEntry, { kind: "bins" }>, day: string): string {
  if (e.kind === "item") return `${ROOM_PAINT[e.item.room].label} · ${e.item.kind === "BUY" ? "to buy" : "job"}`;
  const parts: string[] = [];
  if (e.end > e.start) parts.push(`Day ${dayDiff(e.start, day) + 1} of ${dayDiff(e.start, e.end) + 1}`);
  else if (!e.event.time) parts.push("All day");
  if (e.event.repeat) parts.push(EVENT_REPEAT_LABELS[e.event.repeat]);
  if (e.event.notes) parts.push(e.event.notes);
  return parts.join(" · ");
}

function EventForm({ event, date: startDate, onDone }: { event?: EventDTO; date: string; onDone: (date?: string) => void }) {
  const { addEvent, updateEvent, removeEvent } = useStore();
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? startDate);
  const [timed, setTimed] = useState(!!event?.time);
  const [time, setTime] = useState(event?.time ?? "19:00");
  const [multi, setMulti] = useState(!!event?.endDate);
  const [endDate, setEndDate] = useState(event?.endDate ?? addDays(event?.date ?? startDate, 1));
  const [repeat, setRepeat] = useState<EventRepeat | null>(event?.repeat ?? null);
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const endsBefore = multi && endDate < date;
  const ready = title.trim().length > 0 && !!date && (!timed || !!time) && (!multi || !!endDate) && !endsBefore;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    const fields = {
      title: title.trim(),
      date,
      time: timed ? time : null,
      endDate: multi && endDate > date ? endDate : null,
      repeat,
      notes,
    };
    const saved = event ? await updateEvent(event.id, fields) : await addEvent(fields);
    setBusy(false);
    if (saved) onDone(saved.date);
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <Field label="What">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Mum’s birthday, a gig, Sunday lunch…"
          maxLength={EVENT_TITLE_MAX}
          autoFocus={!event}
          className={inputClass}
        />
      </Field>

      <Field label={multi ? "First day" : "Day"}>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className={clsx(inputClass, "tabular")}
        />
        {multi ? (
          <label className="grid gap-1.5 text-meta font-semibold text-ink-2">
            Last day
            <input
              type="date"
              value={endDate}
              min={date}
              onChange={(e) => e.target.value && setEndDate(e.target.value)}
              aria-invalid={endsBefore}
              className={clsx(inputClass, "tabular")}
            />
            {endsBefore && <span className="text-hint font-normal text-danger">It can’t end before it starts.</span>}
          </label>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <Chip selected={multi} onClick={() => setMulti(!multi)}>
            Over a few days
          </Chip>
        </div>
      </Field>

      <Field label="Time">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip selected={!timed} onClick={() => setTimed(false)}>
            All day
          </Chip>
          <Chip selected={timed} onClick={() => setTimed(true)}>
            At a time
          </Chip>
          {timed && (
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Time"
              className={clsx(inputClass, "w-auto py-1.5 tabular")}
            />
          )}
        </div>
      </Field>

      <Field label="Comes round">
        <div className="flex flex-wrap gap-1.5">
          <Chip selected={repeat === null} onClick={() => setRepeat(null)}>
            Just once
          </Chip>
          {EVENT_REPEATS.map((r) => (
            <Chip key={r} selected={repeat === r} onClick={() => setRepeat(r)}>
              {EVENT_REPEAT_LABELS[r]}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Notes">
        <GrowingTextarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          minRows={2}
          placeholder="Where, tickets, who’s driving…"
          maxLength={2000}
          aria-label="Notes"
          className={inputClass}
        />
      </Field>

      <div className="flex items-center gap-2">
        {event && (
          <Button
            variant="danger"
            onClick={() => {
              removeEvent(event);
              onDone();
            }}
            aria-label={`Take ${event.title} off the calendar`}
            className="px-3"
          >
            <Trash2 size={17} />
          </Button>
        )}
        <Button type="submit" disabled={!ready || busy} className="min-h-11 flex-1">
          {event ? "Save" : "Add to the calendar"}
        </Button>
      </div>
    </form>
  );
}

