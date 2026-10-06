import { describe, expect, it } from "vitest";
import { canGenerate, remainingGenerations, wouldExceedQuota } from "./storage-quota";

describe("wouldExceedQuota", () => {
  it("detects overflow", () => {
    expect(wouldExceedQuota(1000, 500, 1200)).toBe(true);
    expect(wouldExceedQuota(1000, 100, 1200)).toBe(false);
  });
});

describe("AI daily limits", () => {
  it("remaining and canGenerate", () => {
    expect(remainingGenerations(3, 20)).toBe(17);
    expect(canGenerate(20, 20)).toBe(false);
    expect(canGenerate(19, 20)).toBe(true);
  });
});
