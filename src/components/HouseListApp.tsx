"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListFilter, Plus } from "lucide-react";
import { NameGate } from "@/components/NameGate";
import { BudgetBar } from "@/components/BudgetBar";
import { FilterBar } from "@/components/FilterBar";
import { ItemCard } from "@/components/ItemCard";
import { ItemForm, ItemFormValues } from "@/components/ItemForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MarkBoughtDialog } from "@/components/MarkBoughtDialog";
import { EmptyState } from "@/components/EmptyState";
import { useDisplayName } from "@/lib/useDisplayName";
import {
  createItem,
  deleteItem,
  fetchItems,
  fetchSettings,
  logout,
  updateItem,
  updateSettings,
} from "@/lib/api-client";
import { NEXT_STATUS, PRIORITY_ORDER } from "@/lib/types";
import type { ItemDTO, Priority, Room, SortKey, Status } from "@/lib/types";

type Filters = {
  priority: Priority[];
  room: Room[];
  status: Status[];
};

const EMPTY_FILTERS: Filters = { priority: [], room: [], status: [] };

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function sortItems(items: ItemDTO[], sort: SortKey): ItemDTO[] {
  const copy = [...items];
  switch (sort) {
    case "price-desc":
      return copy.sort((a, b) => b.estimatedPrice - a.estimatedPrice);
    case "price-asc":
      return copy.sort((a, b) => a.estimatedPrice - b.estimatedPrice);
    case "recent":
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "priority":
    default:
      return copy.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }
}

type HouseListAppProps = {
  initialItems: ItemDTO[];
  initialBudget: number;
};

export function HouseListApp({ initialItems, initialBudget }: HouseListAppProps) {
  const { name, setName } = useDisplayName();

  const [items, setItems] = useState<ItemDTO[]>(initialItems);
  const [budgetAvailable, setBudgetAvailable] = useState(initialBudget);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("priority");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [formState, setFormState] = useState<{ mode: "add" | "edit"; item?: ItemDTO } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ItemDTO | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [boughtTarget, setBoughtTarget] = useState<ItemDTO | null>(null);
  const [boughtBusy, setBoughtBusy] = useState(false);

  // The list is shared between two people on separate devices with no
  // realtime sync — quietly pick up their changes when this tab regains
  // focus rather than showing stale data indefinitely.
  const refresh = useCallback(async () => {
    try {
      const [freshItems, settings] = await Promise.all([fetchItems({}), fetchSettings()]);
      setItems(freshItems);
      setBudgetAvailable(settings.budgetAvailable);
    } catch {
      // Best-effort background refresh; keep showing what we already have.
    }
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  const filteredSorted = useMemo(() => {
    const filtered = items.filter((item) => {
      if (filters.priority.length && !filters.priority.includes(item.priority)) return false;
      if (filters.room.length && !filters.room.includes(item.room)) return false;
      if (filters.status.length && !filters.status.includes(item.status)) return false;
      return true;
    });
    return sortItems(filtered, sort);
  }, [items, filters, sort]);

  const totals = useMemo(() => {
    const base = { must: 0, like: 0, someday: 0, boughtActual: 0 };
    for (const item of items) {
      if (item.status === "BOUGHT") {
        base.boughtActual += item.actualPrice ?? item.estimatedPrice;
        continue;
      }
      if (item.priority === "MUST_HAVE") base.must += item.estimatedPrice;
      else if (item.priority === "WOULD_LIKE") base.like += item.estimatedPrice;
      else base.someday += item.estimatedPrice;
    }
    return base;
  }, [items]);

  const activeFilterCount = filters.priority.length + filters.room.length + filters.status.length;

  function closeForm() {
    setFormState(null);
  }

  async function handleFormSubmit(values: ItemFormValues) {
    if (formState?.mode === "edit" && formState.item) {
      const updated = await updateItem(formState.item.id, {
        title: values.title.trim(),
        room: values.room,
        estimatedPrice: Number(values.estimatedPrice),
        priority: values.priority,
        status: values.status,
        link: values.link.trim() ? values.link.trim() : null,
        notes: values.notes.trim() ? values.notes.trim() : null,
        addedBy: values.addedBy.trim(),
        actualPrice: values.actualPrice.trim() ? Number(values.actualPrice) : null,
      });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } else {
      const created = await createItem({
        title: values.title.trim(),
        room: values.room,
        estimatedPrice: Number(values.estimatedPrice),
        priority: values.priority,
        link: values.link.trim() || undefined,
        notes: values.notes.trim() || undefined,
        addedBy: values.addedBy.trim(),
      });
      setItems((prev) => [created, ...prev]);
    }
    closeForm();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteItem(deleteTarget.id);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // Leave the dialog open with its busy state cleared so they can retry.
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleAdvanceStatus(item: ItemDTO) {
    const next = NEXT_STATUS[item.status];
    if (!next) return;
    if (next === "BOUGHT") {
      setBoughtTarget(item);
      return;
    }
    const updated = await updateItem(item.id, { status: next });
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  async function handleConfirmBought(actualPrice: number) {
    if (!boughtTarget) return;
    setBoughtBusy(true);
    try {
      const updated = await updateItem(boughtTarget.id, { status: "BOUGHT", actualPrice });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setBoughtTarget(null);
    } catch {
      // keep dialog open on failure
    } finally {
      setBoughtBusy(false);
    }
  }

  async function handleSaveBudget(value: number) {
    await updateSettings(value);
    setBudgetAvailable(value);
  }

  if (!name) {
    return (
      <div className="blueprint-canvas min-h-screen">
        <NameGate onSubmit={setName} />
      </div>
    );
  }

  return (
    <div className="blueprint-canvas min-h-screen">
      <header className="sticky top-0 z-30 border-b border-blueprint-border bg-blueprint-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <h1 className="text-lg font-semibold text-blueprint-ink sm:text-xl">The House List</h1>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-xs text-blueprint-ink-muted sm:inline">
              Signed in as <span className="text-blueprint-ink">{name}</span>
            </span>
            <button
              type="button"
              onClick={() => setFormState({ mode: "add" })}
              className="hidden items-center gap-1.5 rounded bg-someday px-3.5 py-2 text-sm font-medium text-someday-ink transition-colors hover:bg-someday/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint-ink sm:inline-flex"
            >
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              Add item
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 sm:pb-16">
        <div className="space-y-5">
          <BudgetBar
            budgetAvailable={budgetAvailable}
            mustHaveOutstanding={totals.must}
            wouldLikeOutstanding={totals.like}
            somedayOutstanding={totals.someday}
            boughtActualTotal={totals.boughtActual}
            onSaveBudget={handleSaveBudget}
          />

          <div className="rounded-md border border-blueprint-border bg-blueprint-bg-raised/40 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                className="flex items-center gap-2 rounded font-mono text-xs uppercase tracking-wider text-blueprint-ink-muted transition-colors hover:text-blueprint-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
              >
                <ListFilter size={15} strokeWidth={2} aria-hidden="true" />
                Filters &amp; sort
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-someday px-1.5 py-0.5 text-[10px] font-semibold text-someday-ink">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <p className="font-mono text-xs text-blueprint-ink-faint">
                {filteredSorted.length} of {items.length} item{items.length === 1 ? "" : "s"}
              </p>
            </div>

            {filtersOpen && (
              <div className="mt-4 border-t border-blueprint-border pt-4">
                <FilterBar
                  priority={filters.priority}
                  room={filters.room}
                  status={filters.status}
                  sort={sort}
                  onTogglePriority={(v) => setFilters((f) => ({ ...f, priority: toggleValue(f.priority, v) }))}
                  onToggleRoom={(v) => setFilters((f) => ({ ...f, room: toggleValue(f.room, v) }))}
                  onToggleStatus={(v) => setFilters((f) => ({ ...f, status: toggleValue(f.status, v) }))}
                  onSortChange={setSort}
                  onClear={() => setFilters(EMPTY_FILTERS)}
                />
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState variant="no-items" onAddItem={() => setFormState({ mode: "add" })} />
          ) : filteredSorted.length === 0 ? (
            <EmptyState variant="no-matches" onClearFilters={() => setFilters(EMPTY_FILTERS)} />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredSorted.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEdit={() => setFormState({ mode: "edit", item })}
                  onDelete={() => setDeleteTarget(item)}
                  onAdvanceStatus={() => handleAdvanceStatus(item)}
                />
              ))}
            </ul>
          )}
        </div>
      </main>

      <button
        type="button"
        onClick={() => setFormState({ mode: "add" })}
        aria-label="Add item"
        className="fixed right-5 bottom-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-someday text-someday-ink shadow-[0_10px_24px_rgba(0,0,0,0.4)] transition-colors hover:bg-someday/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint-ink sm:hidden"
      >
        <Plus size={24} strokeWidth={2.25} />
      </button>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-center sm:px-6">
        <button
          type="button"
          onClick={() => logout().then(() => window.location.replace("/login"))}
          className="font-mono text-xs text-blueprint-ink-faint underline decoration-blueprint-ink-faint/40 underline-offset-2 hover:text-blueprint-ink-muted"
        >
          Lock this device
        </button>
      </footer>

      <ItemForm
        key={formState ? `${formState.mode}:${formState.item?.id ?? "new"}` : "closed"}
        open={formState !== null}
        mode={formState?.mode ?? "add"}
        initial={formState?.item}
        defaultAddedBy={name}
        onSubmit={handleFormSubmit}
        onCancel={closeForm}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.title ?? ""}"?`}
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        busy={deleteBusy}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <MarkBoughtDialog
        key={boughtTarget?.id ?? "none"}
        item={boughtTarget}
        busy={boughtBusy}
        onConfirm={handleConfirmBought}
        onCancel={() => setBoughtTarget(null)}
      />
    </div>
  );
}
