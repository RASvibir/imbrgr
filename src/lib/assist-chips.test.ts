import { describe, expect, it } from "vitest";
import { ASSIST_CHIPS } from "@/lib/assist-chips";

describe("assist chips", () => {
  it("exposes stable quick-edit labels", () => {
    expect(ASSIST_CHIPS.map((c) => c.label)).toEqual([
      "Brighten",
      "Fix colors",
      "Sharpen",
      "Make it pop",
      "Ember glow",
    ]);
  });
});
