"use client";

import { ArrowRight, ExternalLink, Pencil, Trash2 } from "lucide-react";
import type { ItemDTO } from "@/lib/types";
import { NEXT_STATUS, ROOM_LABELS, STATUS_LABELS } from "@/lib/types";
import { PRIORITY_META } from "@/lib/priorityMeta";
import { formatDate, formatDateShort, formatGBP } from "@/lib/format";

type ItemCardProps = {
  item: ItemDTO;
  onEdit: () => void;
  onDelete: () => void;
  onAdvanceStatus: () => void;
};

export function ItemCard({ item, onEdit, onDelete, onAdvanceStatus }: ItemCardProps) {
  const meta = PRIORITY_META[item.priority];
  const nextStatus = NEXT_STATUS[item.status];
  const bought = item.status === "BOUGHT";
  const delta = bought && item.actualPrice != null ? item.actualPrice - item.estimatedPrice : null;

  return (
    <li
      className={`relative flex flex-col overflow-hidden rounded-md border border-paper-line bg-paper shadow-[0_6px_20px_var(--color-paper-shadow)] ${
        bought ? "opacity-75" : ""
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-[7px] ${meta.solid}`} aria-hidden="true" />

      <div className="flex flex-1 flex-col gap-3 py-4 pl-5 pr-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base leading-snug font-semibold text-paper-ink">
            {item.title}
          </h3>
          <span
            className={`inline-block shrink-0 -rotate-2 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider whitespace-nowrap ${meta.onSoft} ${meta.soft}`}
            style={{ borderColor: "currentColor" }}
          >
            {meta.badge}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-paper-ink-muted">
          <span className="uppercase tracking-wide">{ROOM_LABELS[item.room]}</span>
          <span aria-hidden="true">·</span>
          <span
            className={`uppercase tracking-wide ${bought ? "text-good-dark" : ""}`}
          >
            {STATUS_LABELS[item.status]}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-paper-ink-muted">
              Estimated
            </p>
            <p className="font-tabular font-mono text-lg text-paper-ink">
              {formatGBP(item.estimatedPrice, true)}
            </p>
          </div>
          {item.actualPrice != null && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-paper-ink-muted">
                Actual
              </p>
              <p className="font-tabular font-mono text-lg text-paper-ink">
                {formatGBP(item.actualPrice, true)}
                {delta != null && delta !== 0 && (
                  <span className={`ml-1.5 text-xs ${delta > 0 ? "text-must-ink" : "text-good-dark"}`}>
                    ({delta > 0 ? "+" : "−"}
                    {formatGBP(Math.abs(delta), true)})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {item.notes && (
          <p className="line-clamp-2 text-sm text-paper-ink-muted">{item.notes}</p>
        )}

        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-someday-dark underline decoration-someday-dark/40 underline-offset-2 hover:decoration-someday-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
          >
            View listing
            <ExternalLink size={13} strokeWidth={2} aria-hidden="true" />
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-paper-line bg-paper-raised/60 px-4 py-2.5">
        <div
          className="min-w-0 truncate font-mono text-[11px] whitespace-nowrap text-paper-ink-muted"
          title={formatDate(item.createdAt)}
        >
          <span>{item.addedBy}</span>
          <span aria-hidden="true"> · </span>
          <span>{formatDateShort(item.createdAt)}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${item.title}`}
            className="rounded p-1.5 text-paper-ink-muted transition-colors hover:bg-blueprint-bg/10 hover:text-paper-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
          >
            <Pencil size={15} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${item.title}`}
            className="rounded p-1.5 text-paper-ink-muted transition-colors hover:bg-must-soft hover:text-must-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
          >
            <Trash2 size={15} strokeWidth={2} />
          </button>
          {nextStatus && (
            <button
              type="button"
              onClick={onAdvanceStatus}
              className="ml-1 flex items-center gap-1 rounded bg-blueprint-bg px-2.5 py-1.5 text-xs font-medium text-blueprint-ink transition-colors hover:bg-blueprint-bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
            >
              Mark {STATUS_LABELS[nextStatus]}
              <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
