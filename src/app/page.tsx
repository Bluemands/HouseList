import { HouseListApp } from "@/components/HouseListApp";
import { getState } from "@/lib/data";
import { computeCalendarToken, computeConnectorToken, computeWorkerToken } from "@/lib/auth";

// Live shared data straight from the database — never prerendered, or every
// visitor would see a frozen snapshot from build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { items, settings, jobs } = await getState();
  const calendarPath = `/api/calendar/${await computeCalendarToken()}.ics`;
  const connectorPath = `/api/mcp/${await computeConnectorToken()}`;
  return (
    <HouseListApp
      initialItems={items}
      initialSettings={settings}
      initialJobs={jobs}
      calendarPath={calendarPath}
      connectorPath={connectorPath}
      workerToken={await computeWorkerToken()}
    />
  );
}
