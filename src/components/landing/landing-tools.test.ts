import { describe, it, expect } from "vitest";
import { OUTCOME_TOOLS, type OutcomeTool } from "./landing-tools";
import { getCanvasPreviewKind } from "./OutcomeTiles";

describe("Landing Outcome Tools", () => {
  it("provides 6 outcome-driven tools sourced from registry", () => {
    expect(OUTCOME_TOOLS.length).toBe(6);
    const ids = OUTCOME_TOOLS.map((t: OutcomeTool) => t.id);
    expect(ids).toEqual(["meme", "gif", "collage", "style", "ar", "ai"]);
  });

  it("has valid landing copy, links, and badges for each tile", () => {
    for (const tool of OUTCOME_TOOLS) {
      expect(tool.id).toBeTruthy();
      expect(tool.outcome).toBeTruthy();
      expect(tool.promise).toBeTruthy();
      expect(tool.cta).toBeTruthy();
      expect(tool.href.startsWith("/")).toBe(true);
      expect(tool.badge).toBeTruthy();
    }
  });

  it("maps tile ids to correct procedural canvas preview kinds in OutcomeTiles", () => {
    const previewKinds = OUTCOME_TOOLS.map((tool) => getCanvasPreviewKind(tool));
    expect(previewKinds).toEqual(["meme", "gif", "collage", "filter", "ar", "ai"]);
  });
});
