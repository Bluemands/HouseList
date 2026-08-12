import type { ItemDTO, Priority, Room, SortKey, Status } from "@/lib/types";

export class ApiError extends Error {
  fieldErrors?: Record<string, string[] | undefined>;
  status: number;

  constructor(message: string, status: number, fieldErrors?: Record<string, string[] | undefined>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.error ?? "Something went wrong", res.status, body.fieldErrors);
  }
  return body as T;
}

export type ItemFilters = {
  priority?: Priority[];
  room?: Room[];
  status?: Status[];
  sort?: SortKey;
};

export function buildItemsQuery(filters: ItemFilters): string {
  const params = new URLSearchParams();
  filters.priority?.forEach((p) => params.append("priority", p));
  filters.room?.forEach((r) => params.append("room", r));
  filters.status?.forEach((s) => params.append("status", s));
  if (filters.sort) params.set("sort", filters.sort);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchItems(filters: ItemFilters): Promise<ItemDTO[]> {
  const res = await fetch(`/api/items${buildItemsQuery(filters)}`);
  const data = await handle<{ items: ItemDTO[] }>(res);
  return data.items;
}

export type ItemCreateInput = {
  title: string;
  room: Room;
  estimatedPrice: number;
  priority: Priority;
  link?: string;
  notes?: string;
  addedBy: string;
};

export async function createItem(input: ItemCreateInput): Promise<ItemDTO> {
  const res = await fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await handle<{ item: ItemDTO }>(res);
  return data.item;
}

export type ItemUpdateInput = Partial<{
  title: string;
  room: Room;
  estimatedPrice: number;
  actualPrice: number | null;
  priority: Priority;
  status: Status;
  link: string | null;
  notes: string | null;
  addedBy: string;
}>;

export async function updateItem(id: string, input: ItemUpdateInput): Promise<ItemDTO> {
  const res = await fetch(`/api/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await handle<{ item: ItemDTO }>(res);
  return data.item;
}

export async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
  await handle<{ ok: true }>(res);
}

export async function fetchSettings(): Promise<{ id: number; budgetAvailable: number }> {
  const res = await fetch("/api/settings");
  const data = await handle<{ settings: { id: number; budgetAvailable: number } }>(res);
  return data.settings;
}

export async function updateSettings(budgetAvailable: number) {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budgetAvailable }),
  });
  const data = await handle<{ settings: { id: number; budgetAvailable: number } }>(res);
  return data.settings;
}

export async function login(pin: string): Promise<void> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  await handle<{ ok: true }>(res);
}

export async function logout(): Promise<void> {
  await fetch("/api/auth", { method: "DELETE" });
}
