import type { ItemDTO, SettingsDTO } from "@/lib/types";
import type { Unfurled } from "@/lib/unfurl";
import type { AiJobDTO, AiJobUpdate } from "@/lib/ai";
import type { ItemCreateInput, ItemUpdateInput, SettingsUpdateInput } from "@/lib/validation";
import type { PrintLine, PrintOutDTO, PrintOutSummary } from "@/lib/printouts";

export class ApiError extends Error {
  fieldErrors?: Record<string, string[] | undefined>;
  status: number;

  constructor(message: string, status: number, fieldErrors?: Record<string, string[] | undefined>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      // A FormData body (a photo) sets its own multipart type.
      headers: typeof init?.body === "string" ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError("You're offline — that didn't save", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A locked session (cookie cleared elsewhere) — but a wrong PIN is also a
    // 401, and that one must stay on the login form to show its message.
    if (res.status === 401 && url !== "/api/auth") window.location.replace("/login");
    throw new ApiError(body.error ?? "Something went wrong — try again", res.status, body.fieldErrors);
  }
  return body as T;
}

export function fetchState() {
  return request<{ items: ItemDTO[]; settings: SettingsDTO; jobs: AiJobDTO[] }>("/api/state", { cache: "no-store" });
}

export async function createItem(input: ItemCreateInput): Promise<ItemDTO> {
  const data = await request<{ item: ItemDTO }>("/api/items", { method: "POST", body: JSON.stringify(input) });
  return data.item;
}

export async function createItems(items: Omit<ItemCreateInput, "addedBy">[], addedBy: string): Promise<ItemDTO[]> {
  const data = await request<{ items: ItemDTO[] }>("/api/items/bulk", {
    method: "POST",
    body: JSON.stringify({ items, addedBy }),
  });
  return data.items;
}

export function updateItem(id: string, input: ItemUpdateInput) {
  return request<{ item: ItemDTO; potDelta: number; spawned: ItemDTO | null; removedIds: string[] }>(`/api/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

async function itemCall(url: string, method: string, body?: unknown): Promise<ItemDTO> {
  const data = await request<{ item: ItemDTO }>(url, { method, body: body ? JSON.stringify(body) : undefined });
  return data.item;
}

export const addQuote = (itemId: string, quote: { from: string; amount: number; note?: string | null; addedBy: string }) =>
  itemCall(`/api/items/${itemId}/quotes`, "POST", quote);
export const updateQuote = (quoteId: string, patch: { from?: string; amount?: number; note?: string | null; chosen?: boolean }) =>
  itemCall(`/api/quotes/${quoteId}`, "PATCH", patch);
export const deleteQuote = (quoteId: string) => itemCall(`/api/quotes/${quoteId}`, "DELETE");
export const addComment = (itemId: string, text: string, author: string) =>
  itemCall(`/api/items/${itemId}/comments`, "POST", { text, author });
export const deleteComment = (commentId: string) => itemCall(`/api/comments/${commentId}`, "DELETE");

export async function addPhoto(itemId: string, photo: { full: Blob; thumb: Blob; width: number; height: number }, addedBy: string) {
  const form = new FormData();
  form.set("full", photo.full, "full.jpg");
  form.set("thumb", photo.thumb, "thumb.jpg");
  form.set("width", String(photo.width));
  form.set("height", String(photo.height));
  form.set("addedBy", addedBy);
  const data = await request<{ item: ItemDTO }>(`/api/items/${itemId}/photos`, { method: "POST", body: form });
  return data.item;
}
export const deletePhoto = (photoId: string) => itemCall(`/api/photos/${photoId}`, "DELETE");

/** A product page's name and price, or null when it can't be read (often: shops block servers). */
export async function unfurl(url: string): Promise<Unfurled | null> {
  try {
    const data = await request<{ ok: boolean } & Unfurled>("/api/unfurl", { method: "POST", body: JSON.stringify({ url }) });
    const { ok, ...page } = data;
    return ok ? page : null;
  } catch {
    return null;
  }
}

/** Queue a question for Claude about an item; a worker answers it later. */
export async function askClaude(
  itemId: string,
  input: { question?: string | null; requestedBy: string; autofill?: boolean; improve?: boolean },
): Promise<AiJobDTO> {
  const data = await request<{ job: AiJobDTO }>(`/api/items/${itemId}/ai`, { method: "POST", body: JSON.stringify(input) });
  return data.job;
}

export async function updateJob(id: string, status: AiJobUpdate): Promise<AiJobDTO> {
  const data = await request<{ job: AiJobDTO }>(`/api/ai-jobs/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  return data.job;
}

/** Takes back what "Improve with Claude" changed; answers with the item as it is now. */
export async function undoImprove(id: string, actor: string) {
  return request<{ job: AiJobDTO; item: ItemDTO; potDelta: number }>(`/api/ai-jobs/${id}/undo`, {
    method: "POST",
    body: JSON.stringify({ actor }),
  });
}

export async function deleteItem(id: string): Promise<void> {
  await request(`/api/items/${id}`, { method: "DELETE" });
}

export async function updateSettings(input: SettingsUpdateInput): Promise<SettingsDTO> {
  const data = await request<{ settings: SettingsDTO }>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return data.settings;
}

export async function login(pin: string): Promise<void> {
  await request("/api/auth", { method: "POST", body: JSON.stringify({ pin }) });
}

export async function logout(): Promise<void> {
  await fetch("/api/auth", { method: "DELETE" });
}

export async function createPrintOut(input: { title: string; createdBy: string; lines: PrintLine[] }): Promise<string> {
  const { id } = await request<{ id: string }>("/api/printouts", { method: "POST", body: JSON.stringify(input) });
  return id;
}

export async function listPrintOuts(): Promise<PrintOutSummary[]> {
  const { printOuts } = await request<{ printOuts: PrintOutSummary[] }>("/api/printouts", { cache: "no-store" });
  return printOuts;
}

export async function fetchPrintOut(id: string): Promise<PrintOutDTO> {
  const { printOut } = await request<{ printOut: PrintOutDTO }>(`/api/printouts/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  return printOut;
}
