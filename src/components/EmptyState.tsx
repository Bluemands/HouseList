import { ClipboardList, SearchX } from "lucide-react";

type EmptyStateProps = {
  variant: "no-items" | "no-matches";
  onAddItem?: () => void;
  onClearFilters?: () => void;
};

export function EmptyState({ variant, onAddItem, onClearFilters }: EmptyStateProps) {
  const noItems = variant === "no-items";

  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-blueprint-border px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-blueprint-border text-blueprint-ink-muted">
        {noItems ? (
          <ClipboardList size={20} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <SearchX size={20} strokeWidth={1.75} aria-hidden="true" />
        )}
      </span>
      <div>
        <p className="font-medium text-blueprint-ink">
          {noItems ? "The list is empty" : "Nothing matches those filters"}
        </p>
        <p className="mt-1 max-w-sm text-sm text-blueprint-ink-muted">
          {noItems
            ? "Add the first thing you want to buy, fix, or change in the house."
            : "Try clearing a filter or two to see more of the list."}
        </p>
      </div>
      {noItems && onAddItem && (
        <button
          type="button"
          onClick={onAddItem}
          className="mt-2 rounded bg-blueprint-bg-raised px-4 py-2 text-sm font-medium text-blueprint-ink transition-colors hover:bg-blueprint-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
        >
          Add an item
        </button>
      )}
      {!noItems && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-2 rounded bg-blueprint-bg-raised px-4 py-2 text-sm font-medium text-blueprint-ink transition-colors hover:bg-blueprint-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
