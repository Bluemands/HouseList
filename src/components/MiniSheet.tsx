"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { useSheetDrag } from "@/lib/useSheetDrag";

/**
 * A small bottom sheet (a side panel on desktop), for the few things that
 * need typing for: on a board, or a payment. Closing never loses anything
 * that matters: nothing here is saved until its button is pressed.
 */
export function MiniSheet({
  title,
  leaving,
  onClose,
  children,
  footer,
}: {
  title: string;
  leaving: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useSheetDrag(onClose);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      // Opened over a board or another sheet: its Escape and taps are its own.
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!leaving) onClose();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !leaving) onClose();
      }}
      className={clsx(
        leaving && "sheet-leaving",
        "sheet m-0 inset-x-0 top-auto bottom-0 flex max-h-[90dvh] w-full max-w-none flex-col overflow-hidden rounded-t-sheet bg-surface p-0 text-ink shadow-sheet",
        "lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:max-h-none lg:w-[460px] lg:rounded-none lg:rounded-l-sheet",
      )}
    >
      <div {...drag} className="relative flex touch-none items-center justify-between gap-2 px-5 pt-4 pb-2">
        <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-line-strong lg:hidden" />
        <h2 className="text-title font-bold tracking-[-0.01em]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="hit -mr-2 grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-sunken"
        >
          <X size={19} />
        </button>
      </div>
      <div className="grid flex-1 content-start gap-4 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pt-1 pb-5">{children}</div>
      {footer && (
        <div className="flex items-center gap-2 border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </dialog>
  );
}
