import { describe, expect, it } from "vitest";
import { itemUpdateSchema } from "@/lib/validation";

describe("dates", () => {
  it("takes real calendar dates", () => {
    expect(itemUpdateSchema.safeParse({ dueDate: "2028-02-29" }).success).toBe(true);
    expect(itemUpdateSchema.safeParse({ dueDate: null }).success).toBe(true);
  });

  it("refuses days a month doesn't have, rather than rolling into the next", () => {
    // Stored as given, 31 February would quietly become 3 March.
    expect(itemUpdateSchema.safeParse({ dueDate: "2027-02-31" }).success).toBe(false);
    expect(itemUpdateSchema.safeParse({ dueDate: "2027-02-29" }).success).toBe(false);
    expect(itemUpdateSchema.safeParse({ warrantyUntil: "2027-04-31" }).success).toBe(false);
    expect(itemUpdateSchema.safeParse({ dueDate: "2027-13-01" }).success).toBe(false);
  });
});
