import type { NextRequest } from "next/server";
import { getPayments, getState } from "@/lib/data";
import { KIND_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/types";
import { roomLabel } from "@/lib/rooms";

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvResponse(rows: unknown[][], name: string) {
  const csv = rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  // Leading BOM so Excel opens it as UTF-8 (£ signs survive).
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${date}.csv"`,
    },
  });
}

/** Money between the two of you, newest bill first. */
async function paymentsCsv() {
  const payments = await getPayments();
  const header = ["What for", "Owed by", "Owed to", "Amount", "Whole bill", "Bill date", "Paid on", "Ticked off by", "Settle-up", "Added by"];
  const rows = payments.map((p) => [
    p.description,
    p.owedBy,
    p.owedTo,
    p.amount,
    p.billTotal,
    p.billedOn,
    p.paidOn,
    p.paidBy,
    p.settlementId ? "Yes" : "",
    p.addedBy,
  ]);
  return csvResponse([header, ...rows], "house-list-payments");
}

// Everything as a spreadsheet, so the data is never trapped in here.
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("what") === "payments") return paymentsCsv();
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
    "Links",
    "Guarantee until",
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
    i.steps
      .map((s) => `${s.done ? "[x]" : "[ ]"} ${s.text}${s.cost != null ? ` (£${s.cost})` : ""}${s.link ? ` ${s.link}` : ""}`)
      .join("; "),
    i.links.join(" "),
    i.warrantyUntil,
    i.notes,
    i.addedBy,
    i.createdAt.slice(0, 10),
    i.completedBy,
    i.completedAt?.slice(0, 10),
  ]);
  return csvResponse([header, ...rows], "house-list");
}
