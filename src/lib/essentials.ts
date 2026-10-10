import type { ItemCreateInput } from "@/lib/validation";

type Essential = Omit<ItemCreateInput, "addedBy"> & { why: string };

// The jobs nearly every UK household gets round to in the first few months.
// Costs are rough guides only, and every one is editable after adding.
export const ESSENTIALS: Essential[] = [
  { title: "Change the locks", room: "WHOLE_HOUSE", priority: "MUST_HAVE", estimatedPrice: 150, estimateMax: 250, why: "You don't know who else has keys." },
  { title: "Take meter readings", room: "WHOLE_HOUSE", priority: "MUST_HAVE", why: "Gas, electric and water, so you only pay from your move-in day." },
  { title: "Find the stopcock and label it", room: "KITCHEN", priority: "MUST_HAVE", why: "Usually under the kitchen sink. You'll want it fast in a leak." },
  { title: "Find the fuse box and label the circuits", room: "UNDERSTAIR_CUPBOARD", priority: "MUST_HAVE", why: "Saves guesswork when something trips." },
  { title: "Test smoke and CO alarms", room: "LANDING", priority: "MUST_HAVE", repeat: "MONTHLY", why: "Press the button once a month." },
  { title: "Buy a carbon monoxide alarm", kind: "BUY", room: "WHOLE_HOUSE", priority: "MUST_HAVE", estimatedPrice: 20, estimateMax: 30, why: "One near the boiler and any gas fire." },
  { title: "Set up council tax, broadband and change of address", room: "WHOLE_HOUSE", priority: "MUST_HAVE", steps: [{ text: "Council tax" }, { text: "Broadband" }, { text: "Bank and DVLA" }, { text: "GP and dentist" }], why: "The admin that's easy to forget." },
  { title: "Check home insurance covers contents", room: "WHOLE_HOUSE", priority: "MUST_HAVE", why: "Buildings cover usually starts on exchange; contents is separate." },
  { title: "Service the boiler", room: "WHOLE_HOUSE", priority: "WOULD_LIKE", estimatedPrice: 80, estimateMax: 120, repeat: "YEARLY", why: "Yearly, ideally before winter." },
  { title: "Bleed the radiators", room: "WHOLE_HOUSE", priority: "WOULD_LIKE", repeat: "YEARLY", why: "Cold tops mean trapped air." },
  { title: "Clear the gutters", room: "WHOLE_HOUSE", priority: "WOULD_LIKE", estimatedPrice: 60, estimateMax: 100, repeat: "YEARLY", why: "After the leaves fall." },
  { title: "Fire blanket and extinguisher", kind: "BUY", room: "KITCHEN", priority: "WOULD_LIKE", estimatedPrice: 30, estimateMax: 50, why: "Kept near, not over, the hob." },
  { title: "Basic toolkit", kind: "BUY", room: "UNDERSTAIR_CUPBOARD", priority: "WOULD_LIKE", estimatedPrice: 40, estimateMax: 80, why: "Screwdrivers, hammer, tape measure, spirit level, stud finder." },
  { title: "Check window locks and find the keys", room: "WHOLE_HOUSE", priority: "WOULD_LIKE", why: "Insurers often ask." },
  { title: "Deep clean before unpacking", room: "WHOLE_HOUSE", priority: "WOULD_LIKE", why: "Easier while the cupboards are empty." },
  { title: "Check loft insulation", room: "ATTIC", priority: "SOMEDAY", why: "270mm is the usual recommended depth." },
];
