import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, update, upsert } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { aiPromptCache: { findUnique, update, upsert } } }));

import { getCachedStoryboard, planCacheKey, setCachedStoryboard } from "./plan-cache";

const params = { prompt: "  Neon   Burger ", targetSec: 12, aspectRatio: "16:9" as const };
const board = {
  title: "t",
  narration: "n",
  shots: [{ durationSec: 4, caption: "c", visualPrompt: "a burger", stockQuery: "burger", motion: "zoom-in" as const }],
};

describe("plan cache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keys ignore case and whitespace but differ by length, aspect, style and brand", () => {
    const k = planCacheKey(params);
    expect(planCacheKey({ ...params, prompt: "neon burger" })).toBe(k);
    expect(planCacheKey({ ...params, targetSec: 8 })).not.toBe(k);
    expect(planCacheKey({ ...params, aspectRatio: "9:16" })).not.toBe(k);
    expect(planCacheKey({ ...params, style: "anime" })).not.toBe(k);
    expect(planCacheKey({ ...params, brandName: "Acme" })).not.toBe(k);
  });

  it("returns a valid cached storyboard", async () => {
    findUnique.mockResolvedValue({ source: "storyboard", enhancedPrompt: JSON.stringify(board) });
    expect(await getCachedStoryboard(params)).toEqual(board);
    expect(update).toHaveBeenCalled();
  });

  it("ignores corrupt, foreign or missing rows", async () => {
    findUnique.mockResolvedValueOnce({ source: "storyboard", enhancedPrompt: "{nope" });
    expect(await getCachedStoryboard(params)).toBeNull();
    findUnique.mockResolvedValueOnce({ source: "llm", enhancedPrompt: JSON.stringify(board) });
    expect(await getCachedStoryboard(params)).toBeNull();
    findUnique.mockResolvedValueOnce(null);
    expect(await getCachedStoryboard(params)).toBeNull();
  });

  it("writes the storyboard as JSON and survives a db error", async () => {
    await setCachedStoryboard(params, board);
    expect(upsert).toHaveBeenCalledOnce();
    upsert.mockRejectedValueOnce(new Error("db down"));
    await expect(setCachedStoryboard(params, board)).resolves.toBeUndefined();
  });
});
