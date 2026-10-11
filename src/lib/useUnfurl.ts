"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api-client";
import type { Unfurled } from "@/lib/unfurl";

// One read per link per visit: the quick-add preview, the add itself and the
// detail sheet all ask about the same pasted link.
const pages = new Map<string, Promise<Unfurled | null>>();

export function unfurlLink(url: string): Promise<Unfurled | null> {
  let page = pages.get(url);
  if (!page) {
    page = api.unfurl(url);
    pages.set(url, page);
    // A miss may be a dropped signal in the shop; let a later paste retry.
    page.then((p) => !p && pages.delete(url));
  }
  return page;
}

export type UnfurlState = { status: "idle" | "loading" | "done" | "failed"; data: Unfurled | null };

/** The page behind a link, read once typing pauses. Null reads nothing. */
export function useUnfurl(url: string | null, delay = 300): UnfurlState {
  const [result, setResult] = useState<{ url: string; data: Unfurled | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    const timer = window.setTimeout(
      () => unfurlLink(url).then((data) => live && setResult({ url, data })),
      pages.has(url) ? 0 : delay,
    );
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [url, delay]);
  if (!url) return { status: "idle", data: null };
  if (result?.url !== url) return { status: "loading", data: null };
  return { status: result.data ? "done" : "failed", data: result.data };
}
