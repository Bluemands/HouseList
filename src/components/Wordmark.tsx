import clsx from "clsx";

const FAN = [
  { hex: "#9db39a", rotate: -22 },
  { hex: "#e6b48a", rotate: 0 },
  { hex: "#2f5e4e", rotate: 22 },
];

/** Three paint chips fanned from a pivot, like a deck from the DIY shop. */
export function PaintFan({ size = 26 }: { size?: number }) {
  const w = size * 0.34;
  return (
    <span aria-hidden="true" className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {FAN.map((c) => (
        <span
          key={c.hex}
          className="absolute bottom-0 rounded-[2px] shadow-[0_1px_1.5px_rgb(0_0_0/0.18)]"
          style={{
            left: (size - w) / 2,
            width: w,
            height: size * 0.92,
            background: c.hex,
            transform: `rotate(${c.rotate}deg)`,
            transformOrigin: "50% 92%",
          }}
        />
      ))}
    </span>
  );
}

export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <PaintFan size={compact ? 24 : 28} />
      <span className={clsx("font-bold tracking-[-0.02em] text-ink", compact ? "text-[16px]" : "text-[18px]")}>
        The House List
      </span>
    </div>
  );
}
