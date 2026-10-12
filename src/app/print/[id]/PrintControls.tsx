"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

/**
 * On screen only: back to the app, and print. Arriving with ?auto=1 (straight
 * from a Print button) opens the print dialog once the fonts are in.
 */
export function PrintControls() {
  const router = useRouter();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("auto") !== "1") return;
    url.searchParams.delete("auto");
    window.history.replaceState(null, "", url.pathname);
    document.fonts.ready.then(() => window.print());
  }, []);

  return (
    <nav className="paper-controls">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        className="inline-flex items-center gap-1.5 rounded-control px-3 py-2.5 text-sm font-semibold text-ink-2 hover:bg-sunken hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to the list
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
      >
        <Printer size={16} aria-hidden="true" /> Print
      </button>
    </nav>
  );
}
