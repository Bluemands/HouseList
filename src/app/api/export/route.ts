import { getState } from "@/lib/data";
import { KIND_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/types";
import { roomLabel } from "@/lib/rooms";

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Everything as a spreadsheet, so the data is never trapped in here.
export async function GET() {
  const { items } = await getState();
  const header = [
    "Title",
    "Type",
    "Status",
    "Priority",
    "Room",
    "Who",
    "Due",
    "Estimate",
    "Estimate up to",
    "Quote",
    "Paid",
    "Project",
    "Steps",
    "Link",
    "Notes",
    "Added by",
    "Added",
    "Done by",
    "Done",
  ];
  const rows = items.map((i) => [
    i.title,
    KIND_LABELS[i.kind],
    STATUS_LABELS[i.kind][i.status],
    PRIORITY_LABELS[i.priority],
    roomLabel(i.room),
    i.assignee,
    i.dueDate,
    i.estimatedPrice,
    i.estimateMax,
    i.isQuote ? "Yes" : "",
    i.actualPrice,
    i.project,
    i.steps.map((s) => `${s.done ? "[x]" : "[ ]"} ${s.text}`).join("; "),
    i.link,
    i.notes,
    i.addedBy,
    i.createdAt.slice(0, 10),
    i.completedBy,
    i.completedAt?.slice(0, 10),
  ]);
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  // Leading BOM so Excel opens it as UTF-8 (£ signs survive).
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="house-list-${date}.csv"`,
    },
  });
}
