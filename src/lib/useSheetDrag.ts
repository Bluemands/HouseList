"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, project, rubberband, spring, velocityTracker, type Spring, type VelocityTracker } from "@/lib/motion";

const DISMISS_PX = 110;
// Snappier than scrolling's 0.998, so a light flick doesn't throw the sheet away.
const DECELERATION = 0.99;
/** How long a closing sheet takes to leave; matches .sheet-leaving in globals.css. */
const SHEET_EXIT_MS = 260;

/**
 * Pull a bottom sheet down by its top bar to dismiss it, the way phone sheets
 * work. The sheet follows the finger and can be caught mid-flight; where it
 * goes on release depends on where the flick was heading, not just how far it
 * got. Phones only: on desktop the sheet is a side panel and the mouse has the
 * close button.
 */
export function useSheetDrag(onDismiss: () => void) {
  const drag = useRef<{ sheet: HTMLDialogElement; y: number; from: number; track: VelocityTracker } | null>(null);
  const at = useRef(0);
  const anim = useRef<Spring | null>(null);

  useEffect(() => () => anim.current?.stop(), []);

  function place(el: HTMLElement, y: number) {
    at.current = y;
    el.style.transform = y ? `translateY(${y}px)` : "";
  }

  function settle(el: HTMLElement, to: number, velocity: number, onDone?: () => void) {
    anim.current?.stop();
    anim.current = spring(at.current, to, (y) => place(el, y), { velocity, response: 0.3, onDone });
  }

  function rest(el: HTMLElement) {
    anim.current?.stop();
    place(el, 0);
  }

  return {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      if (e.pointerType === "mouse" || window.matchMedia("(min-width: 1024px)").matches) return;
      if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
      const sheet = e.currentTarget.closest("dialog");
      if (!sheet) return;
      // Caught mid-flight (still opening, or springing back): carry on from
      // where it is on screen rather than jumping.
      anim.current?.stop();
      const from = new DOMMatrix(getComputedStyle(sheet).transform).m42;
      sheet.getAnimations().forEach((a) => a.cancel());
      place(sheet, from);
      drag.current = { sheet, y: e.clientY, from, track: velocityTracker() };
      drag.current.track.add(e.clientY);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d) return;
      d.track.add(e.clientY);
      const y = d.from + e.clientY - d.y;
      // Pulled up past the top it gives a little, rather than stopping dead.
      place(d.sheet, y < 0 ? rubberband(y, d.sheet.offsetHeight) : y);
    },
    onPointerUp() {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      const el = d.sheet;
      const velocity = d.track.velocity();
      if (at.current + project(velocity, DECELERATION) < DISMISS_PX) return settle(el, 0, velocity);
      const height = el.offsetHeight;
      let gone = false;
      settle(el, height, velocity, () => {
        if (!gone) finish();
      });
      // Close as soon as it's out of sight, not when the spring's tail settles.
      const watch = anim.current;
      function finish() {
        gone = true;
        onDismiss();
        // A sheet that stayed open (a save that needs fixing first) comes back
        // up; one that's leaving is put back once it has closed.
        window.setTimeout(() => {
          if (!el.open) return rest(el);
          if (el.classList.contains("sheet-leaving")) return el.addEventListener("close", () => rest(el), { once: true });
          settle(el, 0, 0);
        }, 120);
      }
      const check = () => {
        // Caught again on the way down: the next release decides.
        if (gone || anim.current !== watch || drag.current) return;
        if (at.current >= height - 1) return finish();
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    },
    onPointerCancel() {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      settle(d.sheet, 0, 0);
    },
  };
}

/**
 * Keep a sheet on screen while it slides away after closing. `value` is what
 * the sheet shows (null once closed); `shown` holds on to the last one until
 * the exit has played. `opening` counts each fresh open, for a key, so a
 * sheet reopened mid-exit starts over rather than reusing the leaving one.
 */
export function useSheetExit<T>(value: T | null) {
  const [prev, setPrev] = useState(value);
  const [kept, setKept] = useState(value);
  const [opening, setOpening] = useState(value == null ? 0 : 1);
  if (value !== prev) {
    setPrev(value);
    if (value != null) {
      setKept(value);
      if (prev == null) setOpening((n) => n + 1);
    }
  }
  const leaving = value == null && kept != null;
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setKept(null), prefersReducedMotion() ? 0 : SHEET_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  return { shown: value ?? kept, leaving, opening };
}
