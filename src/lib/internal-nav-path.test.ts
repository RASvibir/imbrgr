import { describe, expect, it } from "vitest";
import { internalNavPathFromHref } from "@/lib/internal-nav-path";

describe("internalNavPathFromHref", () => {
  it("skips external links", () => {
    expect(internalNavPathFromHref("https://fieldpress.studio")).toBeNull();
    expect(internalNavPathFromHref("/tags")).toBe("/tags");
  });
});
