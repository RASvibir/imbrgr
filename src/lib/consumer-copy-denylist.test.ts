import { describe, expect, it } from "vitest";
import { findInternalConsumerCopy } from "./consumer-copy-denylist";

describe("findInternalConsumerCopy", () => {
  it("flags provider and internals wording", () => {
    expect(findInternalConsumerCopy("Powered by Pollinations")).not.toBeNull();
    expect(findInternalConsumerCopy("Prisma client failed")).not.toBeNull();
    expect(findInternalConsumerCopy("set GEMINI_API_KEY")).not.toBeNull();
  });

  it("allows real format names", () => {
    expect(findInternalConsumerCopy("Supports PNG, JPG, WebP, GIF and AVIF")).toBeNull();
    expect(findInternalConsumerCopy("Download MP4")).toBeNull();
  });

  it("allows ordinary copy", () => {
    expect(findInternalConsumerCopy("Fun Filters & Magic Lab")).toBeNull();
  });
});
