"use client";

import { useRef } from "react";

const DISMISS_PX = 110;
const FLICK_PX_PER_MS = 0.5;

/**
 * Pull a bottom sheet down by its top bar to dismiss it, the way phone sheets
 * work. The sheet follows the finger; a long pull or a quick flick finishes
 * the job, anything less springs back. Phones only: on desktop the sheet is a
 * side panel and the mouse has the close button.
 */
export function useSheetDrag(onDismiss: () => void) {
  const drag = useRef<{ sheet: HTMLDialogElement; y: number; t: number; dy: number } | null>(null);

  function place(el: HTMLElement, y: number, animate: boolean) {
    el.style.transition = animate ? "transform 260ms var(--ease-out-expo)" : "none";
    el.style.transform = y > 0 ? `translateY(${y}px)` : "";
  }

  return {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      if (e.pointerType === "mouse" || window.matchMedia("(min-width: 1024px)").matches) return;
      if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
      const sheet = e.currentTarget.closest("dialog");
      if (!sheet) return;
      drag.current = { sheet, y: e.clientY, t: performance.now(), dy: 0 };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d) return;
      d.dy = Math.max(0, e.clientY - d.y);
      place(d.sheet, d.dy, false);
    },
    onPointerUp() {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      const speed = d.dy / Math.max(1, performance.now() - d.t);
      const el = d.sheet;
      if (d.dy < DISMISS_PX && !(d.dy > 40 && speed > FLICK_PX_PER_MS)) return place(el, 0, true);
      place(el, el.offsetHeight, true);
      window.setTimeout(() => {
        onDismiss();
        // A sheet that stayed open (say, a save that needs fixing first)
        // comes back up; one that closed is reset for next time.
        requestAnimationFrame(() => {
          if (el.isConnected && el.open) place(el, 0, true);
          else el.style.transform = el.style.transition = "";
        });
      }, 200);
    },
    onPointerCancel() {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      place(d.sheet, 0, true);
    },
  };
}
