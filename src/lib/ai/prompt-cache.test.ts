import { describe, expect, it } from "vitest";
import { promptCacheKey } from "./prompt-cache";

describe("promptCacheKey", () => {
  it("normalizes whitespace and style", () => {
    const a = promptCacheKey("  Hello   World ", "photo");
    const b = promptCacheKey("hello world", "photo");
    expect(a).toBe(b);
  });

  it("differs by style", () => {
    const a = promptCacheKey("hello", "photo");
    const b = promptCacheKey("hello", "anime");
    expect(a).not.toBe(b);
  });
});
