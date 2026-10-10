"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { House, LayoutGrid, ListChecks, Plus, Settings, Wallet } from "lucide-react";
import { useDisplayName } from "@/lib/useDisplayName";
import { StoreProvider, useStore } from "@/lib/store";
import { useRoute, type Route, type View } from "@/lib/nav";
import type { ItemDTO, SettingsDTO } from "@/lib/types";
import { NameGate } from "@/components/NameGate";
import { ItemSheet } from "@/components/ItemSheet";
import { BulkAddSheet } from "@/components/BulkAddSheet";
import { SettingsSheet } from "@/components/SettingsSheet";
import { Toasts } from "@/components/Toasts";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Wordmark } from "@/components/Wordmark";
import { HomeView } from "@/components/views/HomeView";
import { ListView } from "@/components/views/ListView";
import { RoomView, RoomsView } from "@/components/views/RoomsView";
import { MoneyView } from "@/components/views/MoneyView";

type Props = { initialItems: ItemDTO[]; initialSettings: SettingsDTO; calendarPath: string };

export function HouseListApp({ initialItems, initialSettings, calendarPath }: Props) {
  const { name, setName, clearName } = useDisplayName();

  if (!name) {
    return <NameGate members={initialSettings.members} onSubmit={setName} />;
  }

  return (
    <StoreProvider initialItems={initialItems} initialSettings={initialSettings} me={name} calendarPath={calendarPath}>
      <Shell onSwitchUser={clearName} />
    </StoreProvider>
  );
}

const NAV: { view: View; label: string; icon: typeof House }[] = [
  { view: "home", label: "Home", icon: House },
  { view: "list", label: "List", icon: ListChecks },
  { view: "rooms", label: "Rooms", icon: LayoutGrid },
  { view: "money", label: "Money", icon: Wallet },
];

function Shell({ onSwitchUser }: { onSwitchUser: () => void }) {
  const { route, go } = useRoute();
  const { openItem, me, editing, bulk, closeBulk } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // "n" to add from anywhere on a keyboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || editing || settingsOpen || bulk) return;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "n") {
        e.preventDefault();
        const quick = document.getElementById("quick-add");
        if (quick) quick.focus();
        else openItem("new");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openItem, editing, settingsOpen, bulk]);

  const addDefaults = route.room ? { room: route.room } : undefined;

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-4 py-6 lg:flex">
        <Wordmark compact className="px-2" />
        <button
          type="button"
          onClick={() => openItem("new", addDefaults)}
          className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-[14px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <Plus size={18} strokeWidth={2.4} /> Add something
          <kbd className="ml-1 rounded border border-white/30 px-1 text-[11px] font-medium opacity-80">N</kbd>
        </button>
        <nav aria-label="Main" className="mt-6 grid gap-0.5">
          {NAV.map(({ view, label, icon: Icon }) => {
            const active = route.view === view;
            return (
              <button
                key={view}
                type="button"
                onClick={() => go({ view })}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[15px] font-semibold transition-colors",
                  active ? "bg-sunken text-ink" : "text-ink-2 hover:bg-sunken/60 hover:text-ink",
                )}
              >
                <Icon size={19} strokeWidth={active ? 2.3 : 2} />
                {label}
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="mt-auto flex items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[14px] text-ink-2 hover:bg-sunken/60 hover:text-ink"
        >
          <Settings size={18} />
          <span className="min-w-0 flex-1 truncate">
            Settings · <span className="font-semibold text-ink">{me}</span>
          </span>
        </button>
      </aside>

      <main className="mx-auto w-full max-w-[800px] px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom)+104px)] sm:px-6 lg:pt-10 lg:pb-16">
        <ViewSwitch route={route} go={go} onSettings={() => setSettingsOpen(true)} />
      </main>

      {/* Phone tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
      >
        <div className="mx-auto grid max-w-[520px] grid-cols-5 items-center px-2">
          {NAV.slice(0, 2).map((n) => (
            <TabButton key={n.view} {...n} active={route.view === n.view} onClick={() => go({ view: n.view })} />
          ))}
          <div className="grid place-items-center">
            <button
              type="button"
              onClick={() => openItem("new", addDefaults)}
              aria-label="Add something"
              className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-ink shadow-pop transition-transform duration-150 active:scale-90"
            >
              <Plus size={24} strokeWidth={2.4} />
            </button>
          </div>
          {NAV.slice(2).map((n) => (
            <TabButton key={n.view} {...n} active={route.view === n.view} onClick={() => go({ view: n.view })} />
          ))}
        </div>
      </nav>

      <ItemSheet />
      {bulk && <BulkAddSheet key={bulk.title} {...bulk} onClose={closeBulk} />}
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSwitchUser={() => {
          setSettingsOpen(false);
          onSwitchUser();
        }}
      />
      <Toasts />
      <OfflineBanner />
    </div>
  );
}

function ViewSwitch({ route, go, onSettings }: { route: Route; go: (r: Route) => void; onSettings: () => void }) {
  switch (route.view) {
    case "list":
      return <ListView />;
    case "rooms":
      return route.room ? <RoomView key={route.room} room={route.room} go={go} /> : <RoomsView go={go} />;
    case "money":
      return <MoneyView />;
    default:
      return <HomeView go={go} onSettings={onSettings} />;
  }
}

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof House;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors",
        active ? "text-ink" : "text-ink-3",
      )}
    >
      <Icon size={22} strokeWidth={active ? 2.3 : 1.9} />
      {label}
    </button>
  );
}
