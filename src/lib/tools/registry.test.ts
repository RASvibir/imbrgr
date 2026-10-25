import { describe, it, expect } from "vitest";
import {
  TOOLS,
  TOOL_CATEGORIES,
  getToolById,
  getToolsByCategory,
  getPopularTools,
  getCreateHubTools,
  getNoveltyTools,
  getLandingTools,
  type ToolCategory,
  type ToolStatus,
  type OutcomeTool,
} from "./registry";

describe("Tool Registry Integrity", () => {
  it("contains unique non-empty IDs for all tools", () => {
    const ids = TOOLS.map((t) => t.id);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id.trim().length).toBeGreaterThan(0);
    }
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("contains valid root-relative hrefs for all tools", () => {
    for (const tool of TOOLS) {
      expect(tool.href.startsWith("/")).toBe(true);
      expect(() => new URL(`https://example.com${tool.href}`)).not.toThrow();
    }
  });

  it("validates all required metadata fields", () => {
    const validCategories = new Set<ToolCategory>(["photo", "video", "gif", "fun", "ar"]);
    const validStatuses = new Set<ToolStatus>(["live", "beta", "soon"]);

    for (const tool of TOOLS) {
      expect(tool.title.trim().length).toBeGreaterThan(0);
      expect(tool.tagline.trim().length).toBeGreaterThan(0);
      expect(tool.description.trim().length).toBeGreaterThan(0);
      expect(tool.emoji.trim().length).toBeGreaterThan(0);
      expect(validCategories.has(tool.category)).toBe(true);
      expect(validStatuses.has(tool.status)).toBe(true);
      expect(Array.isArray(tool.featureChips)).toBe(true);
      expect(tool.featureChips.length).toBeGreaterThan(0);
      expect(Array.isArray(tool.features)).toBe(true);
      expect(tool.cta.trim().length).toBeGreaterThan(0);
      expect(tool.gradient.trim().length).toBeGreaterThan(0);
    }
  });

  it("includes all requested novelty and studio tools", () => {
    const ids = TOOLS.map((t) => t.id);
    const expected = ["image", "video", "fun", "shaders", "meme", "gif", "collage", "filters", "ar"];
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });

  it("retrieves tool by ID correctly", () => {
    const memeTool = getToolById("meme");
    expect(memeTool).toBeDefined();
    expect(memeTool?.title).toBe("Meme Maker");
    expect(memeTool?.href).toBe("/tools/meme");

    const nonExistent = getToolById("non-existent-tool");
    expect(nonExistent).toBeUndefined();
  });

  it("filters tools by category correctly", () => {
    const allTools = getToolsByCategory("all");
    expect(allTools.length).toBe(TOOLS.length);

    const photoTools = getToolsByCategory("photo");
    expect(photoTools.every((t) => t.category === "photo")).toBe(true);
    expect(photoTools.some((t) => t.id === "image")).toBe(true);

    const funTools = getToolsByCategory("fun");
    expect(funTools.every((t) => t.category === "fun")).toBe(true);
    expect(funTools.some((t) => t.id === "meme")).toBe(true);
  });

  it("returns popular tools", () => {
    const popular = getPopularTools();
    expect(popular.length).toBeGreaterThan(0);
    expect(popular.every((t) => t.popular === true)).toBe(true);
  });

  it("returns create hub tools with required IDs", () => {
    const hubTools = getCreateHubTools();
    const hubIds = hubTools.map((t) => t.id);
    expect(hubIds).toContain("image");
    expect(hubIds).toContain("video");
    expect(hubIds).toContain("fun");
  });

  it("returns novelty tools under /tools/* path", () => {
    const novelty = getNoveltyTools();
    expect(novelty.length).toBeGreaterThan(0);
    expect(novelty.every((t) => t.href.startsWith("/tools/"))).toBe(true);
    const noveltyIds = novelty.map((t) => t.id);
    expect(noveltyIds).toContain("meme");
    expect(noveltyIds).toContain("gif");
    expect(noveltyIds).toContain("collage");
    expect(noveltyIds).toContain("filters");
    expect(noveltyIds).toContain("ar");
  });

  it("has valid category definitions in TOOL_CATEGORIES", () => {
    expect(TOOL_CATEGORIES.length).toBe(6);
    const categoryIds = TOOL_CATEGORIES.map((c) => c.id);
    expect(categoryIds).toEqual(["all", "photo", "video", "gif", "fun", "ar"]);
  });

  it("returns outcome-driven tools for the landing page in expected order", () => {
    const landingTools = getLandingTools();
    expect(landingTools.length).toBe(6);

    const ids = landingTools.map((t: OutcomeTool) => t.id);
    expect(ids).toEqual(["meme", "gif", "collage", "style", "ar", "ai"]);

    for (const tool of landingTools) {
      expect(tool.id.trim().length).toBeGreaterThan(0);
      expect(tool.outcome.trim().length).toBeGreaterThan(0);
      expect(tool.promise.trim().length).toBeGreaterThan(0);
      expect(tool.cta.trim().length).toBeGreaterThan(0);
      expect(tool.href.startsWith("/")).toBe(true);
      expect(typeof tool.badge).toBe("string");
    }

    // Verify key destinations
    const styleTool = landingTools.find((t) => t.id === "style");
    expect(styleTool?.href).toBe("/tools/filters");
    expect(styleTool?.outcome).toBe("Style a photo or video");
    expect(styleTool?.badge).toBe("Sizzle & Shaders");

    const aiTool = landingTools.find((t) => t.id === "ai");
    expect(aiTool?.href).toBe("/studio");
    expect(aiTool?.outcome).toBe("Generate images & video with AI");
    expect(aiTool?.badge).toBe("AI Kitchen");
  });
});
