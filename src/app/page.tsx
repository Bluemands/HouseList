import { cookies } from "next/headers";
import { HouseListApp } from "@/components/HouseListApp";
import { LAYOUT_COOKIE } from "@/lib/layout";
import { getState } from "@/lib/data";
import { computeCalendarToken, computeConnectorToken, computeWorkerToken } from "@/lib/auth";

// Live shared data straight from the database — never prerendered, or every
// visitor would see a frozen snapshot from build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { items, settings, jobs } = await getState();
  const calendarPath = `/api/calendar/${await computeCalendarToken()}.ics`;
  const connectorPath = `/api/mcp/${await computeConnectorToken()}`;
  // Each phone keeps its own layout, so the first paint is already the right one.
  const layout = (await cookies()).get(LAYOUT_COOKIE)?.value === "simple" ? "simple" : "full";
  return (
    <HouseListApp
      initialItems={items}
      initialSettings={settings}
      initialJobs={jobs}
      calendarPath={calendarPath}
      connectorPath={connectorPath}
      workerToken={await computeWorkerToken()}
      initialLayout={layout}
    />
  );
}
