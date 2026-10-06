import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    aiGenerationUsage: {
      findUnique,
      upsert,
    },
  },
}));

vi.mock("@/lib/config", () => ({
  aiDailyLimit: () => 20,
}));

describe("AI usage limiting", () => {
  beforeEach(() => {
    upsert.mockReset();
    findUnique.mockReset();
  });

  it("assertCanGenerateAi throws when batch exceeds remaining", async () => {
    findUnique.mockResolvedValue({ count: 19 });
    const { assertCanGenerateAi } = await import("./usage");
    await expect(assertCanGenerateAi("user-1", 2)).rejects.toThrow(/Daily AI limit/);
  });

  it("assertCanGenerateAi throws when at daily limit", async () => {
    findUnique.mockResolvedValue({ count: 20 });
    const { assertCanGenerateAi } = await import("./usage");
    await expect(assertCanGenerateAi("user-1")).rejects.toThrow(/Daily AI limit/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("recordAiGenerationSuccess increments only after success path", async () => {
    findUnique.mockResolvedValue({ count: 2 });
    upsert.mockResolvedValue({ count: 3 });
    const { recordAiGenerationSuccess, getAiUsageToday } = await import("./usage");
    await recordAiGenerationSuccess("user-1");
    expect(upsert).toHaveBeenCalledOnce();
    const usage = await getAiUsageToday("user-1");
    expect(usage.remaining).toBe(18);
  });
});
