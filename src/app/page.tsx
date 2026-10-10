import { HouseListApp } from "@/components/HouseListApp";
import { getState } from "@/lib/data";
import { computeCalendarToken } from "@/lib/auth";

// Live shared data straight from the database — never prerendered, or every
// visitor would see a frozen snapshot from build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { items, settings } = await getState();
  const calendarPath = `/api/calendar/${await computeCalendarToken()}.ics`;
  return <HouseListApp initialItems={items} initialSettings={settings} calendarPath={calendarPath} />;
}
