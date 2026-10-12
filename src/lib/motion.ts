/**
 * The physics behind things you can drag: springs that start from wherever
 * the thing is and carry the finger's speed, a projection of where a flick is
 * heading, and soft resistance past an edge. After Apple's "Designing Fluid
 * Interfaces" (WWDC 2018).
 */

export type Spring = { stop: () => void };

type SpringOptions = {
  /** Starting speed in px/s, usually the finger's at release. */
  velocity?: number;
  /** 1 settles without overshoot; lower bounces. */
  damping?: number;
  /** Roughly how long it takes to get there, in seconds. */
  response?: number;
  /** How close counts as arrived, in px. */
  precision?: number;
  onDone?: () => void;
};

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** One step of a damped spring pulling x towards `to` (unit mass). */
export function springStep(x: number, v: number, to: number, damping: number, response: number, dt: number) {
  const omega = (2 * Math.PI) / response;
  const accel = -omega * omega * (x - to) - 2 * damping * omega * v;
  const nv = v + accel * dt;
  return { x: x + nv * dt, v: nv };
}

/** Animate a number from `from` to `to`, calling `onUpdate` every frame. */
export function spring(from: number, to: number, onUpdate: (x: number) => void, options: SpringOptions = {}): Spring {
  const { damping = 1, response = 0.35, precision = 0.5, onDone } = options;
  if (prefersReducedMotion()) {
    onUpdate(to);
    onDone?.();
    return { stop() {} };
  }
  let x = from;
  let v = options.velocity ?? 0;
  let last = performance.now();
  let raf = requestAnimationFrame(function frame(now) {
    // Small fixed steps keep a stiff spring stable on a slow frame.
    let dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      ({ x, v } = springStep(x, v, to, damping, response, h));
      dt -= h;
    }
    if (Math.abs(to - x) < precision && Math.abs(v) < precision * 40) {
      onUpdate(to);
      onDone?.();
      return;
    }
    onUpdate(x);
    raf = requestAnimationFrame(frame);
  });
  return { stop: () => cancelAnimationFrame(raf) };
}

/**
 * How far a flick at `velocity` (px/s) carries before it would come to rest.
 * 0.998 is scrolling's rate; lower stops sooner.
 */
export function project(velocity: number, deceleration = 0.998) {
  return ((velocity / 1000) * deceleration) / (1 - deceleration);
}

/** Past an edge, follow the finger less the further it goes. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export type VelocityTracker = { add: (position: number, time?: number) => void; velocity: (now?: number) => number };

/**
 * The finger's speed over its last moments, in px/s. Only the recent past
 * counts, so a pull that pauses and then flicks reads as the flick, and one
 * that stops before letting go reads as still.
 */
export function velocityTracker(windowMs = 80): VelocityTracker {
  let samples: { p: number; t: number }[] = [];
  return {
    add(p, t = performance.now()) {
      samples = [...samples.filter((s) => t - s.t <= windowMs), { p, t }];
    },
    velocity(now = performance.now()) {
      const recent = samples.filter((s) => now - s.t <= windowMs);
      if (recent.length < 2) return 0;
      const first = recent[0];
      const last = recent[recent.length - 1];
      return last.t > first.t ? ((last.p - first.p) / (last.t - first.t)) * 1000 : 0;
    },
  };
}
