import { describe, expect, it } from "vitest";
import { project, rubberband, springStep, velocityTracker } from "./motion";

describe("project", () => {
  it("carries a flick further the faster it is", () => {
    expect(project(0)).toBe(0);
    expect(project(1000, 0.99)).toBeCloseTo(99);
    expect(project(-1000, 0.99)).toBeCloseTo(-99);
    expect(project(1000)).toBeGreaterThan(project(1000, 0.99));
  });
});

describe("rubberband", () => {
  it("follows less the further past the edge", () => {
    const near = rubberband(20, 400);
    const far = rubberband(200, 400);
    expect(near).toBeLessThan(20);
    expect(far).toBeLessThan(200);
    expect(far / 200).toBeLessThan(near / 20);
    expect(rubberband(-20, 400)).toBeCloseTo(-near);
  });
});

describe("springStep", () => {
  function run(damping: number, velocity = 0) {
    let s = { x: 0, v: velocity };
    let peak = 0;
    for (let i = 0; i < 240; i++) {
      s = springStep(s.x, s.v, 100, damping, 0.35, 1 / 240);
      peak = Math.max(peak, s.x);
    }
    return { ...s, peak };
  }

  it("settles on the target without overshoot when critically damped", () => {
    const { x, peak } = run(1);
    expect(x).toBeCloseTo(100, 0);
    expect(peak).toBeLessThanOrEqual(100.01);
  });

  it("bounces past the target when under-damped", () => {
    expect(run(0.6).peak).toBeGreaterThan(100);
  });
});

describe("velocityTracker", () => {
  it("measures the recent movement in px/s", () => {
    const t = velocityTracker();
    t.add(0, 0);
    t.add(10, 20);
    t.add(30, 40);
    expect(t.velocity(40)).toBeCloseTo(750);
  });

  it("forgets a slow start before a flick", () => {
    const t = velocityTracker();
    t.add(0, 0);
    t.add(5, 300);
    t.add(5, 400);
    t.add(45, 440);
    expect(t.velocity(440)).toBeCloseTo(1000);
  });

  it("reads as still once the finger has stopped", () => {
    const t = velocityTracker();
    t.add(0, 0);
    t.add(40, 40);
    expect(t.velocity(300)).toBe(0);
  });
});
