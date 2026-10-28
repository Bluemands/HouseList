"use client";

import { ViewTransition } from "react";
import clsx from "clsx";
import { CalendarDays, House, LayoutGrid, ListChecks, Plus, Settings, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Route, View } from "@/lib/nav";
import { useOpenCalendar } from "@/lib/calendar-nav";
import { ItemSheet } from "@/components/ItemSheet";
import { Wordmark } from "@/components/Wordmark";
import { HomeView } from "@/components/views/HomeView";
import { ListView } from "@/components/views/ListView";
import { RoomView, RoomsView } from "@/components/views/RoomsView";
import { MoneyView } from "@/components/views/MoneyView";

const NAV: { view: View; label: string; icon: typeof House }[] = [
  { view: "home", label: "Home", icon: House },
  { view: "list", label: "List", icon: ListChecks },
  { view: "rooms", label: "Rooms", icon: LayoutGrid },
  { view: "money", label: "Money", icon: Wallet },
];

/** The full app: tabs, rooms, money. Loaded on its own, so a simple phone never fetches it. */
export function FullLayout({
  route,
  go,
  onSettings,
}: {
  route: Route;
  go: (r: Route) => void;
  onSettings: () => void;
}) {
  const { openItem, me } = useStore();
  const openCalendar = useOpenCalendar();
  const addDefaults = route.room ? { room: route.room } : undefined;

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-4 py-6 lg:flex">
        <Wordmark compact className="px-2" />
        <button
          type="button"
          onClick={() => openItem("new", addDefaults)}
          className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-supporting font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
        >
          <Plus size={18} strokeWidth={2.4} /> Add something
          <kbd className="ml-1 rounded border border-white/30 px-1 text-label font-medium opacity-80">N</kbd>
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
                  "flex items-center gap-3 rounded-control px-3 py-2 text-body font-semibold transition-colors",
                  active ? "bg-sunken text-ink" : "text-ink-2 hover:bg-sunken/60 hover:text-ink",
                )}
              >
                <Icon size={19} strokeWidth={active ? 2.3 : 2} />
                {label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => openCalendar()}
            className="flex items-center gap-3 rounded-control px-3 py-2 text-body font-semibold text-ink-2 transition-colors hover:bg-sunken/60 hover:text-ink"
          >
            <CalendarDays size={19} strokeWidth={2} />
            Calendar
          </button>
        </nav>
        <button
          type="button"
          onClick={onSettings}
          className="mt-auto flex items-center gap-3 rounded-control px-3 py-2 text-left text-supporting text-ink-2 hover:bg-sunken/60 hover:text-ink"
        >
          <Settings size={18} />
          <span className="min-w-0 flex-1 truncate">
            Settings · <span className="font-semibold text-ink">{me}</span>
          </span>
        </button>
      </aside>

      <main className="mx-auto w-full max-w-[800px] px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom)+104px)] sm:px-6 lg:pt-10 lg:pb-16">
        {/* Each view enters and leaves as a whole: into a room slides in from
            the side, back out slides the other way, and tabs cross-fade. The
            transition types come from useRoute. */}
        <ViewTransition
          key={route.room ?? route.view}
          enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", "nav-tab": "nav-tab", default: "none" }}
          exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", "nav-tab": "nav-tab", default: "none" }}
          default="none"
        >
          <div>
            <ViewSwitch route={route} go={go} onSettings={onSettings} />
          </div>
        </ViewTransition>
      </main>

      {/* Phone tab bar. Named, so it holds still above a view that's moving. */}
      <nav
        aria-label="Main"
        style={{ viewTransitionName: "tab-bar" }}
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
    </div>
  );
}

function ViewSwitch({ route, go, onSettings }: { route: Route; go: (r: Route) => void; onSettings: () => void }) {
  switch (route.view) {
    case "list":
      return <ListView />;
    case "rooms":
      return route.room ? <RoomView room={route.room} go={go} /> : <RoomsView go={go} />;
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
        "flex flex-col items-center gap-0.5 py-2.5 text-label font-semibold transition-colors",
        active ? "text-ink" : "text-ink-3",
      )}
    >
      <Icon size={22} strokeWidth={active ? 2.3 : 1.9} />
      {label}
    </button>
  );
}
