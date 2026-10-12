"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useDisplayName } from "@/lib/useDisplayName";
import { useSheetExit } from "@/lib/useSheetDrag";
import { refreshPush } from "@/lib/push-client";
import { saveLayout, type Layout } from "@/lib/layout";
import { TickBackContext } from "@/components/RecentPrintOuts";
import { StoreProvider, useStore } from "@/lib/store";
import { useRoute } from "@/lib/nav";
import type { ItemDTO, SettingsDTO } from "@/lib/types";
import type { AiJobDTO } from "@/lib/ai";
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

type Props = {
  initialItems: ItemDTO[];
  initialSettings: SettingsDTO;
  initialJobs: AiJobDTO[];
  calendarPath: string;
  connectorPath: string;
  workerToken: string;
  initialLayout: Layout;
};

export function HouseListApp({
  initialItems,
  initialSettings,
  initialJobs,
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
  const simple = layout === "simple";

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
      const id = url.searchParams.get("item");
      if (id) return openItem(id);
      const view = url.searchParams.get("v");
      if (view === "list" || view === "rooms" || view === "money") go({ view });
    }
    const here = new URL(window.location.href);
    if (here.searchParams.has("item") || here.searchParams.has("printout")) {
      follow(here);
      here.searchParams.delete("item");
      here.searchParams.delete("printout");
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
      {simple ? (
        <SimpleLayout onSettings={() => setSettingsOpen(true)} />
      ) : (
        <FullLayout route={route} go={go} onSettings={() => setSettingsOpen(true)} />
      )}
      {shared}
    </TickBackContext.Provider>
  );
}
