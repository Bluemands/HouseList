import { describe, expect, it } from "vitest";
import { nextOccurrence } from "@/lib/types";

describe("nextOccurrence", () => {
  it("steps by each interval", () => {
    expect(nextOccurrence("2026-10-09", "WEEKLY")).toBe("2026-10-16");
    expect(nextOccurrence("2026-10-09", "MONTHLY")).toBe("2026-11-09");
    expect(nextOccurrence("2026-10-09", "QUARTERLY")).toBe("2027-01-09");
    expect(nextOccurrence("2026-10-09", "TWICE_YEARLY")).toBe("2027-04-09");
    expect(nextOccurrence("2026-10-09", "YEARLY")).toBe("2027-10-09");
  });
  it("clamps to the end of shorter months", () => {
    expect(nextOccurrence("2027-01-31", "MONTHLY")).toBe("2027-02-28");
    expect(nextOccurrence("2028-01-31", "MONTHLY")).toBe("2028-02-29");
    expect(nextOccurrence("2028-02-29", "YEARLY")).toBe("2029-02-28");
  });
});
