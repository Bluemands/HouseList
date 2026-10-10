"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Shop basements eat signal. Say so plainly rather than failing quietly. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-40 flex shadow-pop lg:left-[240px] items-center justify-center gap-2 bg-warn-soft px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2 text-[13.5px] font-semibold text-warn"
    >
      <WifiOff size={15} strokeWidth={2.3} aria-hidden="true" />
      You&apos;re offline. You can look, but changes won&apos;t save until you&apos;re back.
    </div>
  );
}
