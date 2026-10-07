import { describe, expect, it } from "vitest";
import { shouldUseLocalImageEdit } from "@/lib/ai/edit-intent";

describe("shouldUseLocalImageEdit", () => {
  it("routes simple adjustments locally", () => {
    expect(shouldUseLocalImageEdit("make it brighter")).toBe(true);
    expect(shouldUseLocalImageEdit("sharpen a bit")).toBe(true);
  });

  it("routes content edits to AI", () => {
    expect(shouldUseLocalImageEdit("add fairies")).toBe(false);
    expect(shouldUseLocalImageEdit("remove the person in the back")).toBe(false);
    expect(shouldUseLocalImageEdit("make it look like a watercolor painting")).toBe(false);
  });
});
