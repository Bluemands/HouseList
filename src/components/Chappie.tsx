import clsx from "clsx";

/**
 * Claude's stand-in while a question is out: a little visor-faced robot with
 * antenna ears (after Chappie). Waiting for a worker to pick it up, he stands
 * still, since nothing is happening yet; only once Claude's working do his
 * ears bob and the visor scan. Drawn in currentColor, so he takes the colour
 * of the text beside him. Decorative: the words next to him say what's
 * happening.
 */
export function Chappie({ working = false, size = 16, className }: { working?: boolean; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx("chappie shrink-0", working ? "chappie-working" : "chappie-waiting", className)}
    >
      <path className="chappie-ear chappie-ear-l" d="M9 9.5 6.3 1.5" strokeWidth={2.6} />
      <path className="chappie-ear chappie-ear-r" d="m15 9.5 2.7-8" strokeWidth={2.6} />
      <rect x="3.5" y="9.5" width="17" height="11.5" rx="3.6" strokeWidth={1.9} />
      <rect x="6.2" y="12.6" width="11.6" height="5.2" rx="2.6" fill="currentColor" stroke="none" />
      <g className="chappie-eyes">
        <rect className="chappie-eye" x="8.4" y="14.3" width="2.2" height="1.8" rx="0.9" />
        <rect className="chappie-eye" x="13.4" y="14.3" width="2.2" height="1.8" rx="0.9" />
      </g>
      <rect className="chappie-scan" x="7.6" y="14.3" width="3.6" height="1.8" rx="0.9" />
    </svg>
  );
}
