import type { Priority, Status } from "@/lib/types";

export const PRIORITY_META: Record<
  Priority,
  { label: string; badge: string; soft: string; onSoft: string; solid: string; onSolid: string }
> = {
  MUST_HAVE: {
    label: "Must have",
    badge: "MUST HAVE",
    soft: "bg-must-soft",
    onSoft: "text-must-ink",
    solid: "bg-must",
    onSolid: "text-on-solid",
  },
  WOULD_LIKE: {
    label: "Would like",
    badge: "WOULD LIKE",
    soft: "bg-like-soft",
    onSoft: "text-like-ink",
    solid: "bg-like",
    // --color-like is light enough that white fails contrast — dark ink
    // works on both its soft tint and its own solid fill.
    onSolid: "text-like-ink",
  },
  SOMEDAY: {
    label: "Someday",
    badge: "SOMEDAY",
    soft: "bg-someday-soft",
    onSoft: "text-someday-dark",
    solid: "bg-someday",
    onSolid: "text-on-solid",
  },
};

export const STATUS_META: Record<Status, { label: string; description: string }> = {
  WISHLIST: { label: "Wishlist", description: "On the list" },
  PLANNED: { label: "Planned", description: "Committed to buying" },
  BOUGHT: { label: "Bought", description: "Done" },
};
