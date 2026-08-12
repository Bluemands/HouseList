export const ROOMS = [
  "KITCHEN",
  "BATHROOM",
  "LIVING_ROOM",
  "BEDROOM",
  "GARDEN",
  "EXTERIOR",
  "WHOLE_HOUSE",
  "OTHER",
] as const;
export type Room = (typeof ROOMS)[number];

export const ROOM_LABELS: Record<Room, string> = {
  KITCHEN: "Kitchen",
  BATHROOM: "Bathroom",
  LIVING_ROOM: "Living Room",
  BEDROOM: "Bedroom",
  GARDEN: "Garden",
  EXTERIOR: "Exterior",
  WHOLE_HOUSE: "Whole House",
  OTHER: "Other",
};

export const PRIORITIES = ["MUST_HAVE", "WOULD_LIKE", "SOMEDAY"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  MUST_HAVE: "Must have",
  WOULD_LIKE: "Would like",
  SOMEDAY: "Someday",
};

// Order used for default "by priority" sorting — most urgent first.
export const PRIORITY_ORDER: Record<Priority, number> = {
  MUST_HAVE: 0,
  WOULD_LIKE: 1,
  SOMEDAY: 2,
};

export const STATUSES = ["WISHLIST", "PLANNED", "BOUGHT"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  WISHLIST: "Wishlist",
  PLANNED: "Planned",
  BOUGHT: "Bought",
};

// The status a "mark as ..." action moves an item to next.
export const NEXT_STATUS: Record<Status, Status | null> = {
  WISHLIST: "PLANNED",
  PLANNED: "BOUGHT",
  BOUGHT: null,
};

export type ItemDTO = {
  id: string;
  title: string;
  room: Room;
  estimatedPrice: number;
  actualPrice: number | null;
  priority: Priority;
  link: string | null;
  notes: string | null;
  addedBy: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
};

export type SortKey = "priority" | "price-desc" | "price-asc" | "recent";
