import { cookies } from "next/headers";
import { HouseListApp } from "@/components/HouseListApp";
import { LAYOUT_COOKIE } from "@/lib/layout";
import { getState } from "@/lib/data";
import { computeCalendarToken, computeConnectorToken, computeWorkerToken } from "@/lib/auth";

// Live shared data straight from the database — never prerendered, or every
// visitor would see a frozen snapshot from build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  // The tokens and cookie don't touch the database, so they're worked out
  // while the state loads.
  const [{ items, settings, jobs, boards, payments, readings }, calendarToken, connectorToken, workerToken, cookieStore] = await Promise.all([
    getState(),
    computeCalendarToken(),
    computeConnectorToken(),
    computeWorkerToken(),
    cookies(),
  ]);
  const calendarPath = `/api/calendar/${calendarToken}.ics`;
  const connectorPath = `/api/mcp/${connectorToken}`;
  // Each phone keeps its own layout, so the first paint is already the right one.
  const layout = cookieStore.get(LAYOUT_COOKIE)?.value === "simple" ? "simple" : "full";
  return (
    <HouseListApp
      initialItems={items}
      initialSettings={settings}
      initialJobs={jobs}
      initialBoards={boards}
      initialPayments={payments}
      initialReadings={readings}
      calendarPath={calendarPath}
      connectorPath={connectorPath}
      workerToken={workerToken}
      initialLayout={layout}
    />
  );
}
