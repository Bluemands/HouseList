import { HouseListApp } from "@/components/HouseListApp";
import { getInitialData } from "@/lib/data";

// This reads live, per-user shared data straight from the database — it must
// never be statically prerendered/cached, or every visitor would see a
// frozen snapshot from build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { items, budgetAvailable } = await getInitialData();

  return <HouseListApp initialItems={items} initialBudget={budgetAvailable} />;
}
