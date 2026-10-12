"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { whatsNew } from "@/lib/news";
import { PaintChip } from "@/components/ui";

const keyFor = (me: string) => `hl-last-seen:${me.toLowerCase()}`;

/**
 * What the other person did since this device last opened the app — the
 * thing a shared list most needs to say out loud.
 */
export function SinceLastTime() {
  const { items, me, openItem } = useStore();
  // Snapshot the previous visit once, then mark this one as seen.
  const [since] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(keyFor(me));
    } catch {
      return null;
    }
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(keyFor(me), new Date().toISOString());
    } catch {}
  }, [me]);

  const news = useMemo(() => (since ? whatsNew(items, me, since) : null), [items, me, since]);

  if (!news || dismissed) return null;

  const { who, sentence } = news;
  const visible = news.entries.slice(0, 5);
  const more = news.entries.length - visible.length;

  return (
    <section aria-label="Since you last looked" className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-body text-ink">
          <span className="font-semibold">Since you last looked,</span> {who} {sentence}.
        </p>
        <button
          type="button"
          aria-label="Got it"
          onClick={() => setDismissed(true)}
          className="hit -mt-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
      <ul className="mt-2.5 grid gap-1.5">
        {visible.map(({ key, item, label, note }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => openItem(item.id)}
              className="flex w-full items-center gap-2.5 rounded-lg py-0.5 text-left text-supporting hover:text-accent-text"
            >
              <PaintChip room={item.room} />
              <span
                className={
                  label === "Done"
                    ? "min-w-0 flex-1 truncate text-ink-2 line-through decoration-ink-3/50"
                    : "min-w-0 flex-1 truncate text-ink"
                }
              >
                {item.title}
                {note && <span className="text-ink-2"> — {note}</span>}
              </span>
              <span className="shrink-0 text-hint font-semibold text-ink-3">{label}</span>
            </button>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="mt-1.5 text-meta text-ink-3">and {more} more</p>}
    </section>
  );
}
