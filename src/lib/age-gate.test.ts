import { describe, expect, it } from "vitest";
import { isAtLeast18, parseBirthDate } from "./age-gate";

describe("age-gate", () => {
  it("parses valid YYYY-MM-DD dates and rejects invalid or future dates", () => {
    expect(parseBirthDate("1995-05-20")?.toISOString().slice(0, 10)).toBe("1995-05-20");
    expect(parseBirthDate("2000-02-30")).toBeNull();
    expect(parseBirthDate("1850-01-01")).toBeNull();
    expect(parseBirthDate("2999-01-01")).toBeNull();
    expect(parseBirthDate("not-a-date")).toBeNull();
  });

  it("checks exact 18th birthday boundary in UTC", () => {
    const now = new Date("2026-11-27T12:00:00Z");
    expect(isAtLeast18(new Date("2008-11-27T00:00:00Z"), now)).toBe(true);
    expect(isAtLeast18(new Date("2008-11-28T00:00:00Z"), now)).toBe(false);
    expect(isAtLeast18(new Date("2008-12-01T00:00:00Z"), now)).toBe(false);
    expect(isAtLeast18(new Date("2007-11-28T00:00:00Z"), now)).toBe(true);
  });
});
