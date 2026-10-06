import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const usageFindUnique = vi.fn();
const userFindUnique = vi.fn();
const siteSettingUpsert = vi.fn();
const siteSettingFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    aiGenerationUsage: {
      findUnique: usageFindUnique,
      upsert,
    },
    user: {
      findUnique: userFindUnique,
    },
    siteSetting: {
      upsert: siteSettingUpsert,
      findUnique: siteSettingFindUnique,
    },
  },
}));

vi.mock("@/lib/config", () => ({
  aiDailyLimit: () => 20,
  anonAiDailyLimit: () => 5,
}));

describe("AI usage limiting", () => {
  beforeEach(() => {
    upsert.mockReset();
    usageFindUnique.mockReset();
    userFindUnique.mockReset();
    siteSettingFindUnique.mockResolvedValue(null);
    siteSettingUpsert.mockResolvedValue({});
    userFindUnique.mockResolvedValue({ aiDailyLimitOverride: null });
  });

  it("assertCanGenerateAi throws when batch exceeds remaining", async () => {
    usageFindUnique.mockResolvedValue({ count: 19 });
    const { assertCanGenerateAi } = await import("./usage");
    await expect(assertCanGenerateAi("user-1", 2)).rejects.toThrow(/Daily AI limit/);
  });

  it("assertCanGenerateAi throws when at daily limit", async () => {
    usageFindUnique.mockResolvedValue({ count: 20 });
    const { assertCanGenerateAi } = await import("./usage");
    await expect(assertCanGenerateAi("user-1")).rejects.toThrow(/Daily AI limit/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("recordAiGenerationSuccess increments only after success path", async () => {
    usageFindUnique.mockResolvedValue({ count: 2 });
    upsert.mockResolvedValue({ count: 3 });
    const { recordAiGenerationSuccess, getAiUsageToday } = await import("./usage");
    await recordAiGenerationSuccess("user-1");
    expect(upsert).toHaveBeenCalledOnce();
    const usage = await getAiUsageToday("user-1");
    expect(usage.remaining).toBe(18);
  });
});
