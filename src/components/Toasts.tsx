"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "lucide-react";
import { useStore, type Toast } from "@/lib/store";
import { parseMoney } from "@/components/StepsField";

/**
 * An open sheet is a modal dialog: everything outside it is inert and drawn
 * underneath, so a toast raised while one is open (an undo, an error) has to
 * live inside it to be seen or tapped.
 */
function useToastHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const pick = () => setHost(([...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].at(-1) ?? document.body));
    pick();
    const observer = new MutationObserver(pick);
    observer.observe(document.body, { subtree: true, childList: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, []);
  return host;
}

/**
 * "What did it cost?" under a finish that assumed the bottom of a range.
 * Optional: leaving it keeps the guess, and the toast stays while it's in use.
 */
function PriceAsk({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const { holdToast } = useStore();
  const [value, setValue] = useState("");
  const amount = parseMoney(value);
  const valid = amount != null && !Number.isNaN(amount);
  const ask = toast.price!;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        ask.save(amount);
        onDone();
      }}
      className="flex items-center gap-2 border-t border-white/10 pt-2 pb-0.5"
    >
      <label htmlFor={`toast-price-${toast.id}`} className="min-w-0 flex-1 leading-snug">
        What did it cost? <span className="whitespace-nowrap opacity-60">({ask.guess})</span>
      </label>
      <div className="relative w-[96px] shrink-0">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 opacity-60">£</span>
        <input
          id={`toast-price-${toast.id}`}
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={value}
          placeholder={ask.placeholder}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
          onFocus={() => holdToast(toast.id, true)}
          onBlur={() => holdToast(toast.id, false)}
          className="tabular w-full rounded-lg bg-white/10 py-1.5 pr-2 pl-6 text-bg outline-none placeholder:text-bg/40 focus:bg-white/15 focus:ring-2 focus:ring-accent-soft/50"
        />
      </div>
      <button
        type="submit"
        disabled={!valid}
        className="shrink-0 rounded-lg px-3 py-1.5 font-bold text-accent-soft hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Save
      </button>
    </form>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  const host = useToastHost();
  if (!host) return null;
  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-50 flex flex-col items-center gap-2 px-3 lg:bottom-6 lg:left-[240px]"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={clsx(
            "toast-in pointer-events-auto flex w-full max-w-[460px] flex-col rounded-[14px] py-1.5 pr-1.5 pl-4 text-[14px] shadow-pop",
            t.leaving && "toast-out",
            t.tone === "error" ? "bg-danger text-white" : "bg-ink text-bg",
          )}
        >
          <div className="flex items-center gap-1">
            <span className="min-w-0 flex-1 py-1.5 leading-snug">{t.message}</span>
            {t.secondary && (
              <button
                type="button"
                onClick={() => {
                  t.secondary!.run();
                  dismissToast(t.id);
                }}
                className="shrink-0 rounded-lg px-2.5 py-1.5 font-semibold opacity-80 hover:bg-white/10 hover:opacity-100"
              >
                {t.secondary.label}
              </button>
            )}
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action!.run();
                  dismissToast(t.id);
                }}
                className="shrink-0 rounded-lg px-3 py-1.5 font-bold text-accent-soft hover:bg-white/10"
              >
                {t.action.label}
              </button>
            ) : (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismissToast(t.id)}
                className="hit grid h-8 w-8 shrink-0 place-items-center rounded-lg opacity-70 hover:bg-white/10 hover:opacity-100"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {t.price && <PriceAsk toast={t} onDone={() => dismissToast(t.id)} />}
        </div>
      ))}
    </div>,
    host,
  );
}
