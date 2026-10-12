/**
 * Which layout this phone shows: the full app, or the simple checklist. Kept
 * in a cookie so the server draws the right one first time; each phone
 * chooses for itself.
 */
export type Layout = "full" | "simple";

export const LAYOUT_COOKIE = "house-list-layout";

export function saveLayout(layout: Layout) {
  document.cookie = `${LAYOUT_COOKIE}=${layout}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax`;
}
