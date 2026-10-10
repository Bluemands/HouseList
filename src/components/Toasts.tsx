"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";

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
            "toast-in pointer-events-auto flex w-full max-w-[460px] items-center gap-1 rounded-[14px] py-1.5 pr-1.5 pl-4 text-[14px] shadow-pop",
            t.tone === "error" ? "bg-danger text-white" : "bg-ink text-bg",
          )}
        >
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
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg opacity-70 hover:bg-white/10 hover:opacity-100"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
    </div>,
    host,
  );
}
