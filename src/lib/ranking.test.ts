import { describe, expect, it } from "vitest";
import { hotScore, topScore } from "./ranking";

describe("topScore", () => {
  it("subtracts downvotes from upvotes", () => {
    expect(topScore(10, 3)).toBe(7);
  });
});

describe("hotScore", () => {
  it("ranks newer higher when votes equal", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const older = new Date("2026-01-01T10:00:00Z");
    const newer = new Date("2026-01-01T11:00:00Z");
    expect(hotScore(5, 1, newer, now)).toBeGreaterThan(hotScore(5, 1, older, now));
  });
});
