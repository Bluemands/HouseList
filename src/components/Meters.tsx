"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Camera, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSheetExit } from "@/lib/useSheetDrag";
import { dayDiff, describeDay, today } from "@/lib/format";
import {
  METERS,
  METER_INFO,
  intervals,
  latest,
  monthlyUsage,
  oddReading,
  readingsOf,
  recentPerDay,
  type Meter,
  type ReadingDTO,
} from "@/lib/meters";
import { MiniSheet } from "@/components/MiniSheet";
import { Button, Field, SectionHead, Segmented, inputClass } from "@/components/ui";

// Meter readings on the Money tab: the last of each, how much you use a day,
// month by month, and a monthly reminder to take them.

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const perDay = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const monthName = (key: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date(`${key}-01T12:00:00`));
const ago = (day: string) => {
  const days = dayDiff(day, today());
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

export function Meters() {
  const { readings } = useStore();
  const [adding, setAdding] = useState(false);
  const sheet = useSheetExit(adding || null);
  return (
    <section aria-labelledby="meters-head">
      <SectionHead id="meters-head" title="Meters">
        <Button variant="ghost" onClick={() => setAdding(true)} className="-mr-2 px-3 py-1.5">
          <Plus size={16} /> Add readings
        </Button>
      </SectionHead>
      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-4">
        {readings.length === 0 ? (
          <p className="text-supporting text-ink-2">
            Read the gas, electric and water meters now and then. After the second time, this shows how much you use a day,
            month by month.
          </p>
        ) : (
          <>
            <Latest readings={readings} />
            <Usage readings={readings} />
            <AllReadings readings={readings} />
          </>
        )}
        <Reminder />
      </div>
      {sheet.shown && <ReadingsSheet key={sheet.opening} leaving={sheet.leaving} onClose={() => setAdding(false)} />}
    </section>
  );
}

/** The last reading of each meter, and roughly what it's using. */
function Latest({ readings }: { readings: ReadingDTO[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {METERS.map((m) => {
        const last = latest(readings, m);
        const rate = recentPerDay(readings, m);
        return (
          <li key={m} className="grid content-start gap-0.5 rounded-xl bg-sunken px-3 py-2.5">
            <span className="text-meta font-semibold text-ink-2">{METER_INFO[m].label}</span>
            {last ? (
              <>
                <span className="truncate text-body font-bold text-ink tabular">{number.format(last.value)}</span>
                <span className="text-hint text-ink-3">{ago(last.takenOn)}</span>
                {rate != null && (
                  <span className="text-hint text-ink-3 tabular">
                    ≈{perDay.format(rate)} {METER_INFO[m].unit}/day
                  </span>
                )}
              </>
            ) : (
              <span className="text-hint text-ink-3">Not read yet</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Use a day, month by month, for one meter at a time. */
function Usage({ readings }: { readings: ReadingDTO[] }) {
  const charted = METERS.filter((m) => intervals(readings, m).length > 0);
  const [meter, setMeter] = useState<Meter | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const shown = meter && charted.includes(meter) ? meter : charted[0];
  const months = shown ? monthlyUsage(readings, shown, today()) : [];
  if (!shown) return null;
  const unit = METER_INFO[shown].unit;
  const max = Math.max(...months.map((m) => m.perDay ?? 0), 0.0001);
  return (
    <figure className="grid gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-meta font-semibold text-ink-2">Use a day, by month</span>
        {charted.length > 1 && (
          <Segmented
            label="Meter"
            size="sm"
            value={shown}
            onChange={setMeter}
            options={charted.map((m) => ({ value: m, label: METER_INFO[m].label }))}
          />
        )}
      </div>
      <div className="flex h-24 items-end gap-2" onMouseLeave={() => setHover(null)}>
        {months.map((m) => (
          <button
            key={m.key}
            type="button"
            onMouseEnter={() => setHover(m.key)}
            onFocus={() => setHover(m.key)}
            onBlur={() => setHover(null)}
            aria-label={`${monthName(m.key)}: ${m.perDay == null ? "no readings" : `${perDay.format(m.perDay)} ${unit} a day`}`}
            className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
          >
            {hover === m.key && m.perDay != null && (
              <span className="absolute -top-1 z-10 -translate-y-full rounded-md bg-ink px-2 py-1 text-hint font-semibold whitespace-nowrap text-bg tabular shadow-pop">
                {perDay.format(m.perDay)} {unit}
              </span>
            )}
            <span
              className={clsx(
                "w-full max-w-9 rounded-t-[4px] transition-[height,background-color] duration-500 ease-out",
                hover === m.key ? "bg-accent-hover" : "bg-accent",
              )}
              style={{
                height: m.perDay != null ? `${Math.max(4, (m.perDay / max) * 100)}%` : "2px",
                opacity: m.perDay != null ? 1 : 0.35,
              }}
            />
          </button>
        ))}
      </div>
      <div className="flex gap-2 border-t border-line pt-1.5">
        {months.map((m) => (
          <span key={m.key} className="flex-1 text-center text-hint text-ink-3">
            {monthName(m.key)}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {METER_INFO[shown].label} use a day by month:{" "}
        {months.map((m) => `${monthName(m.key)} ${m.perDay == null ? "none" : `${perDay.format(m.perDay)} ${unit}`}`).join(", ")}
      </figcaption>
    </figure>
  );
}

const READINGS_PAGE = 9;

/** Every reading, newest first, to check one or take a mistake back out. */
function AllReadings({ readings }: { readings: ReadingDTO[] }) {
  const { removeReading } = useStore();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(READINGS_PAGE);
  const list = useMemo(
    () => [...readings].sort((a, b) => (a.takenOn === b.takenOn ? b.createdAt.localeCompare(a.createdAt) : b.takenOn.localeCompare(a.takenOn))),
    [readings],
  );
  return (
    <div className="border-t border-line pt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-supporting font-semibold text-ink-2 hover:text-ink"
      >
        All readings
        <ChevronDown size={17} className={clsx("transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div className="grid gap-1 pb-1">
          <ul>
            {list.slice(0, limit).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-1.5 text-supporting">
                {r.photoId ? (
                  <a href={`/api/photos/${r.photoId}`} target="_blank" rel="noreferrer" className="shrink-0" aria-label="See the photo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a private, already-small photo */}
                    <img src={`/api/photos/${r.photoId}?size=thumb`} alt="" className="h-9 w-9 rounded-md bg-sunken object-cover" />
                  </a>
                ) : (
                  <span className="h-9 w-9 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-ink">
                    {METER_INFO[r.meter].label}{" "}
                    <span className="font-semibold tabular">{number.format(r.value)}</span>{" "}
                    <span className="text-ink-3">{METER_INFO[r.meter].unit}</span>
                  </span>
                  <span className="block text-meta text-ink-3">
                    {describeDay(r.takenOn).replace(/^on /, "")} · {r.takenBy}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  onClick={() => removeReading(r)}
                  aria-label={`Delete the ${METER_INFO[r.meter].label.toLowerCase()} reading`}
                  className="px-2 py-2 text-ink-3"
                >
                  <Trash2 size={16} />
                </Button>
              </li>
            ))}
          </ul>
          {list.length > limit && (
            <Button variant="ghost" onClick={() => setLimit((l) => l + READINGS_PAGE * 2)} className="justify-self-start px-2">
              Show more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** The day of the month the morning reminder asks for readings. */
function Reminder() {
  const { settings, saveSettings } = useStore();
  const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
  return (
    <label className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-supporting text-ink-2">
      Remind us to read them
      <select
        value={settings.meterDay ?? ""}
        onChange={(e) => saveSettings({ meterDay: e.target.value ? Number(e.target.value) : null })}
        className={clsx(inputClass, "w-auto py-1.5")}
      >
        <option value="">Never</option>
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            On the {ordinal(d)} of each month
          </option>
        ))}
      </select>
    </label>
  );
}

type Draft = { value: string; photo: File | null };

/** Reading all three at once (or whichever you have), each with a photo if you like. */
function ReadingsSheet({ leaving, onClose }: { leaving: boolean; onClose: () => void }) {
  const { readings, addReadings } = useStore();
  const [takenOn, setTakenOn] = useState(today());
  const [drafts, setDrafts] = useState<Record<Meter, Draft>>({
    GAS: { value: "", photo: null },
    ELECTRIC: { value: "", photo: null },
    WATER: { value: "", photo: null },
  });
  const [busy, setBusy] = useState(false);
  const set = (m: Meter, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [m]: { ...d[m], ...patch } }));
  const parse = (s: string) => {
    const n = Number(s.replace(/,/g, ""));
    return s.trim() && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const filled = METERS.filter((m) => parse(drafts[m].value) != null);

  async function save() {
    if (!filled.length || busy) return;
    setBusy(true);
    const saved = await addReadings(
      filled.map((m) => ({ meter: m, value: parse(drafts[m].value)!, takenOn: takenOn || today(), photo: drafts[m].photo })),
    );
    setBusy(false);
    if (saved === filled.length) onClose();
  }

  return (
    <MiniSheet
      title="Meter readings"
      leaving={leaving}
      onClose={onClose}
      footer={
        <Button onClick={save} disabled={!filled.length || busy} className="min-h-11 flex-1">
          {filled.length > 1 ? `Save ${filled.length} readings` : "Save reading"}
        </Button>
      }
    >
      <Field label="Taken on">
        <input
          type="date"
          value={takenOn}
          max={today()}
          onChange={(e) => setTakenOn(e.target.value)}
          className={clsx(inputClass, "tabular")}
        />
      </Field>
      {METERS.map((m) => {
        const before = readingsOf(readings, m).filter((r) => r.takenOn <= takenOn);
        const last = before.at(-1) ?? null;
        const value = parse(drafts[m].value);
        const odd = value == null ? null : oddReading(last, value, takenOn, recentPerDay(readings, m));
        return (
          <Field
            key={m}
            label={`${METER_INFO[m].label} (${METER_INFO[m].unit})`}
            hint={
              odd === "lower"
                ? `That’s lower than last time (${number.format(last!.value)}). A typo, or a new meter?`
                : odd === "high"
                  ? "That’s a lot more than usual since last time. Worth a second look."
                  : last
                    ? `Last: ${number.format(last.value)}, ${describeDay(last.takenOn)}`
                    : undefined
            }
          >
            <div className="flex items-center gap-2">
              <input
                inputMode="decimal"
                value={drafts[m].value}
                onChange={(e) => set(m, { value: e.target.value.replace(/[^\d.,]/g, "") })}
                placeholder={last ? number.format(last.value) : "Reading"}
                aria-label={`${METER_INFO[m].label} reading`}
                className={clsx(inputClass, "tabular", odd && "border-danger!")}
              />
              {drafts[m].photo ? (
                <Button
                  variant="secondary"
                  onClick={() => set(m, { photo: null })}
                  aria-label={`Remove the ${METER_INFO[m].label.toLowerCase()} photo`}
                  className="shrink-0 px-3"
                >
                  <Camera size={16} /> <X size={14} />
                </Button>
              ) : (
                <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-ink hover:bg-sunken">
                  <Camera size={16} />
                  <span className="sr-only">Add a photo of the {METER_INFO[m].label.toLowerCase()} meter</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => set(m, { photo: e.target.files?.[0] ?? null })}
                  />
                </label>
              )}
            </div>
          </Field>
        );
      })}
      <p className="text-hint text-ink-3">Fill in whichever you’ve read. The camera keeps a photo of the dial, in case a bill is ever disputed.</p>
    </MiniSheet>
  );
}
