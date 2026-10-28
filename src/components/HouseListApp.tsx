"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useDisplayName } from "@/lib/useDisplayName";
import { useSheetExit } from "@/lib/useSheetDrag";
import { refreshPush } from "@/lib/push-client";
import { saveLayout, type Layout } from "@/lib/layout";
import { TickBackContext } from "@/components/RecentPrintOuts";
import { BoardNavContext } from "@/lib/board-nav";
import { CalendarNavContext } from "@/lib/calendar-nav";
import { today } from "@/lib/format";
import type { BoardTarget } from "@/components/board/BoardLayer";
import { StoreProvider, useStore } from "@/lib/store";
import { useRoute } from "@/lib/nav";
import type { ItemDTO, SettingsDTO } from "@/lib/types";
import type { AiJobDTO } from "@/lib/ai";
import type { BoardDTO } from "@/lib/boards";
import type { PaymentDTO } from "@/lib/payments";
import type { ReadingDTO } from "@/lib/meters";
import type { TradespersonDTO } from "@/lib/tradespeople";
import type { EventDTO } from "@/lib/events";
import { NameGate } from "@/components/NameGate";
import { SettingsSheet } from "@/components/SettingsSheet";
import { Toasts } from "@/components/Toasts";
import { OfflineBanner } from "@/components/OfflineBanner";

// Each phone only downloads the layout it shows; the server still draws it
// first time. The two sheets below open rarely, so they load when they do.
const FullLayout = dynamic(() => import("@/components/FullLayout").then((m) => m.FullLayout));
const SimpleLayout = dynamic(() => import("@/components/SimpleLayout").then((m) => m.SimpleLayout));
const BulkAddSheet = dynamic(() => import("@/components/BulkAddSheet").then((m) => m.BulkAddSheet));
const TickBackSheet = dynamic(() => import("@/components/TickBackSheet").then((m) => m.TickBackSheet));
const BoardLayer = dynamic(() => import("@/components/board/BoardLayer").then((m) => m.BoardLayer));
const CalendarSheet = dynamic(() => import("@/components/CalendarSheet").then((m) => m.CalendarSheet));

type Props = {
  initialItems: ItemDTO[];
  initialSettings: SettingsDTO;
  initialJobs: AiJobDTO[];
  initialBoards: BoardDTO[];
  initialPayments: PaymentDTO[];
  initialReadings: ReadingDTO[];
  initialTradespeople: TradespersonDTO[];
  initialEvents: EventDTO[];
  calendarPath: string;
  connectorPath: string;
  workerToken: string;
  initialLayout: Layout;
};

export function HouseListApp({
  initialItems,
  initialSettings,
  initialJobs,
  initialBoards,
  initialPayments,
  initialReadings,
  initialTradespeople,
  initialEvents,
  calendarPath,
  connectorPath,
  workerToken,
  initialLayout,
}: Props) {
  const { name, setName, clearName } = useDisplayName();
  const [layout, setLayout] = useState(initialLayout);

  if (!name) {
    return <NameGate members={initialSettings.members} onSubmit={setName} />;
  }

  return (
    <StoreProvider
      initialItems={initialItems}
      initialSettings={initialSettings}
      initialJobs={initialJobs}
      initialBoards={initialBoards}
      initialPayments={initialPayments}
      initialReadings={initialReadings}
      initialTradespeople={initialTradespeople}
      initialEvents={initialEvents}
      me={name}
      calendarPath={calendarPath}
      connectorPath={connectorPath}
      workerToken={workerToken}
    >
      <Shell
        onSwitchUser={clearName}
        layout={layout}
        onLayout={(next) => {
          saveLayout(next);
          setLayout(next);
        }}
      />
    </StoreProvider>
  );
}

function Shell({
  onSwitchUser,
  layout,
  onLayout,
}: {
  onSwitchUser: () => void;
  layout: Layout;
  onLayout: (layout: Layout) => void;
}) {
  const { route, go } = useRoute();
  const { openItem, me, editing, bulk, closeBulk } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bulkSheet = useSheetExit(bulk);
  // A print-out being ticked back in, by id.
  const [tickBack, setTickBack] = useState<string | null>(null);
  const tickSheet = useSheetExit(tickBack);
  // The boards, drawn over either layout. Opening one adds a history entry,
  // so a phone's back button closes it.
  const [boardTarget, setBoardTarget] = useState<BoardTarget | null>(null);
  const boardLayer = useSheetExit(boardTarget);
  // The calendar, open on a day.
  const [calendarDay, setCalendarDay] = useState<string | null>(null);
  const calendarSheet = useSheetExit(calendarDay);
  const openCalendar = useCallback((day?: string) => setCalendarDay(day ?? today()), []);
  const simple = layout === "simple";

  const openBoards = useCallback((target: BoardTarget) => {
    window.history.pushState({ boards: true }, "", window.location.href);
    setBoardTarget(target);
  }, []);

  useEffect(() => {
    if (!boardTarget) return;
    const onPop = () => setBoardTarget(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [boardTarget]);

  // "n" to add from anywhere on a keyboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || editing || settingsOpen || bulk || simple) return;
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
  }, [openItem, editing, settingsOpen, bulk, simple]);

  // Opened from a notification: "?item=…" opens that item (then leaves the
  // address as it was), and a tap while the app's already open arrives as a
  // message from the service worker instead.
  useEffect(() => {
    function follow(url: URL) {
      // A print-out's QR code: tick it back in.
      const printOut = url.searchParams.get("printout");
      if (printOut) return setTickBack(printOut);
      // An event's notification: the calendar on its day.
      const day = url.searchParams.get("day");
      if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) return setCalendarDay(day);
      const id = url.searchParams.get("item");
      if (id) return openItem(id);
      const view = url.searchParams.get("v");
      if (view === "list" || view === "rooms" || view === "money") go({ view });
    }
    const here = new URL(window.location.href);
    if (here.searchParams.has("item") || here.searchParams.has("printout") || here.searchParams.has("day")) {
      follow(here);
      here.searchParams.delete("item");
      here.searchParams.delete("printout");
      here.searchParams.delete("day");
      window.history.replaceState(null, "", here.search || here.pathname);
    }
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "open") follow(new URL(e.data.url, window.location.origin));
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [openItem, go]);

  // A phone with notifications on reminds the server whose phone it is.
  useEffect(() => {
    if (me) refreshPush(me);
  }, [me]);

  // Sheets both layouts share.
  const shared = (
    <>
      {bulkSheet.shown && (
        <BulkAddSheet
          key={`${bulkSheet.opening}:${bulkSheet.shown.title}`}
          {...bulkSheet.shown}
          leaving={bulkSheet.leaving}
          onClose={closeBulk}
        />
      )}
      {tickSheet.shown && (
        <TickBackSheet
          key={`${tickSheet.opening}:${tickSheet.shown}`}
          id={tickSheet.shown}
          leaving={tickSheet.leaving}
          onClose={() => setTickBack(null)}
        />
      )}
      {boardLayer.shown && (
        <BoardLayer
          key={boardLayer.opening}
          target={boardLayer.shown}
          leaving={boardLayer.leaving}
          onClose={() => (window.history.state?.boards ? window.history.back() : setBoardTarget(null))}
        />
      )}
      {calendarSheet.shown && (
        <CalendarSheet
          key={calendarSheet.opening}
          day={calendarSheet.shown}
          leaving={calendarSheet.leaving}
          onClose={() => setCalendarDay(null)}
        />
      )}
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        layout={layout}
        onLayout={onLayout}
        onSwitchUser={() => {
          setSettingsOpen(false);
          onSwitchUser();
        }}
      />
      <Toasts />
      <OfflineBanner />
    </>
  );

  return (
    <TickBackContext.Provider value={setTickBack}>
      <BoardNavContext.Provider value={openBoards}>
      <CalendarNavContext.Provider value={openCalendar}>
      {simple ? (
        <SimpleLayout onSettings={() => setSettingsOpen(true)} />
      ) : (
        <FullLayout route={route} go={go} onSettings={() => setSettingsOpen(true)} />
      )}
      {shared}
      </CalendarNavContext.Provider>
      </BoardNavContext.Provider>
    </TickBackContext.Provider>
  );
}
