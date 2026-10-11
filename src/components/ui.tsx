"use client";

import clsx from "clsx";
import type { Priority, Room } from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";

export function PaintChip({ room, className }: { room: Room; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx("chip", className)}
      style={{ "--paint": ROOM_PAINT[room].hex } as React.CSSProperties}
    />
  );
}

export function RoomTag({ room }: { room: Room }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <PaintChip room={room} className="!h-2.5 !w-2.5" />
      {ROOM_PAINT[room].label}
    </span>
  );
}

/** Priority is typographic, never a colour: only the exceptions show. */
export function PriorityTag({ priority }: { priority: Priority }) {
  if (priority === "MUST_HAVE") {
    return (
      <span className="rounded-[4px] bg-ink px-1.5 py-px text-[11px] leading-4 font-bold tracking-wide text-bg">
        Must
      </span>
    );
  }
  if (priority === "SOMEDAY") {
    return <span className="text-[12px] text-ink-3 italic">Someday</span>;
  }
  return null;
}

/** The round tick target. Finishing floods it with the room's paint. */
export function TickButton({
  done,
  room,
  label,
  onToggle,
  size = "md",
}: {
  done: boolean;
  room: Room;
  label: string;
  onToggle: () => void;
  size?: "md" | "lg";
}) {
  const paint = ROOM_PAINT[room];
  const dim = size === "lg" ? "h-8 w-8" : "h-[26px] w-[26px]";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Mark “${label}” as not done` : `Mark “${label}” as done`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      // A 44px hit area around a smaller visual circle.
      className="group/tick relative -m-[9px] grid shrink-0 place-items-center p-[9px]"
    >
      <span
        className={clsx(
          dim,
          "grid place-items-center rounded-full border-[1.5px] transition-colors duration-150",
          done
            ? "tick-fill border-transparent"
            : "border-line-strong group-hover/tick:border-accent group-hover/tick:bg-accent-soft",
        )}
        style={done ? { background: paint.hex } : undefined}
      >
        <svg
          viewBox="0 0 16 16"
          className={clsx(size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5", !done && "opacity-0 group-hover/tick:opacity-60")}
          fill="none"
          stroke={done ? paint.ink : "var(--accent)"}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path className={done ? "tick-path" : undefined} d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[10px] bg-sunken p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-[7px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150",
            size === "sm" ? "px-2.5 py-1 text-[13px]" : "px-3 py-1.5 text-sm",
            value === o.value
              ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.1)]"
              : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150",
        selected
          ? "border-accent bg-accent-soft text-accent-text"
          : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-sm font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-accent text-accent-ink hover:bg-accent-hover",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-sunken",
        variant === "ghost" && "text-ink-2 hover:bg-sunken hover:text-ink",
        variant === "danger" && "text-danger hover:bg-danger-soft",
        className,
      )}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-2">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/20";

export function MoneyInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-ink-3">£</span>
      <input
        aria-label={label}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        className={clsx(inputClass, "tabular pl-7")}
      />
    </div>
  );
}

/** A one-tap offer to fill a field from somewhere else — never applied without the tap. */
export function Suggestion({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 max-w-full min-w-0 items-center rounded-full border border-accent/35 bg-accent-soft px-3.5 text-[13px] font-semibold text-accent-text transition-[background-color,transform] duration-150 hover:border-accent active:scale-[0.97]"
    >
      <span className="truncate">{children}</span>
    </button>
  );
}

/** A section heading with an optional trailing control. */
export function SectionHead({ title, children, id }: { title: string; children?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-[17px] font-bold tracking-[-0.01em] text-ink">
        {title}
      </h2>
      {children}
    </div>
  );
}
