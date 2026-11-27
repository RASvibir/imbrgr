import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  enhanceVideoPrompt: vi.fn(),
  plannerAvailable: vi.fn(),
  planStoryboard: vi.fn(),
  getCachedStoryboard: vi.fn(),
  setCachedStoryboard: vi.fn(),
  consumePlanLimits: vi.fn(),
  consumeRateLimit: vi.fn(),
  assertUserMayUseAi: vi.fn(),
  assertCanGenerateAiForUser: vi.fn(),
  assertCanGenerateAiForAnonymous: vi.fn(),
  createVideoJob: vi.fn(),
}));

vi.mock("@/lib/request-identity", () => ({ getActor: mocks.getActor }));
vi.mock("@/lib/ai/prompt-enhance", () => ({ enhanceVideoPrompt: mocks.enhanceVideoPrompt }));
vi.mock("@/lib/ai/director/planner", () => ({
  plannerAvailable: mocks.plannerAvailable,
  planStoryboard: mocks.planStoryboard,
}));
vi.mock("@/lib/ai/director/plan-cache", () => ({
  getCachedStoryboard: mocks.getCachedStoryboard,
  setCachedStoryboard: mocks.setCachedStoryboard,
}));
vi.mock("@/lib/ai/director/limits", () => ({ consumePlanLimits: mocks.consumePlanLimits }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock("@/lib/user-guards", () => ({ assertUserMayUseAi: mocks.assertUserMayUseAi }));
vi.mock("@/lib/ai/usage", () => ({
  assertCanGenerateAiForUser: mocks.assertCanGenerateAiForUser,
  assertCanGenerateAiForAnonymous: mocks.assertCanGenerateAiForAnonymous,
}));
vi.mock("@/lib/ai/video-job/service", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/video-job/service")>();
  return {
    ...actual,
    createVideoJob: mocks.createVideoJob,
  };
});

import { POST } from "./route";

function call(body: unknown) {
  return POST(
    new Request("http://localhost/api/ai/video/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/ai/video/jobs prompt-assist behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActor.mockResolvedValue({ userId: "u1", voterKey: "u:u1", ipHash: "h" });
    mocks.assertUserMayUseAi.mockResolvedValue(null);
    mocks.consumeRateLimit.mockResolvedValue(1);
    mocks.assertCanGenerateAiForUser.mockResolvedValue(undefined);
    mocks.assertCanGenerateAiForAnonymous.mockResolvedValue(undefined);
    mocks.plannerAvailable.mockReturnValue(true);
    mocks.getCachedStoryboard.mockResolvedValue(null);
    mocks.consumePlanLimits.mockResolvedValue({ ok: true });
    mocks.setCachedStoryboard.mockResolvedValue(undefined);
    mocks.enhanceVideoPrompt.mockResolvedValue({
      prompt: "sunset burger sizzling on cast iron, warm rim light, macro lens",
      source: "groq",
    });
    mocks.planStoryboard.mockResolvedValue({
      storyboard: {
        title: "t",
        narration: "n",
        shots: [
          {
            durationSec: 5,
            caption: "c",
            visualPrompt: "shot 1",
            stockQuery: "burger",
            motion: "zoom-in",
          },
        ],
      },
      provider: "mock",
    });
    mocks.createVideoJob.mockImplementation(async (_actor, input, shots) => ({
      id: "job-1",
      ownerKey: "u:u1",
      userId: "u1",
      ipHash: null,
      status: "queued",
      input,
      shots,
      nextShot: 0,
      error: null,
    }));
  });

  it("checks isPromptBlocked before calling enhanceVideoPrompt", async () => {
    const res = await call({ prompt: "nsfw burger" });
    expect(res.status).toBe(400);
    expect(mocks.enhanceVideoPrompt).not.toHaveBeenCalled();
  });

  it("skips third-party enhance when mature=true and uses local enrichment only", async () => {
    const res = await call({ prompt: "sunset burger", mature: true, mode: "video", durationSec: 6 });
    expect(res.status).toBe(200);
    expect(mocks.enhanceVideoPrompt).not.toHaveBeenCalled();
    expect(mocks.planStoryboard).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.job.promptUsed).toContain("sunset burger");
    expect(data.job.promptSource).toBe("local");
  });

  it("sends originalPrompt to storyboard planner while keeping enhanced prompt in input/promptUsed", async () => {
    const res = await call({ prompt: "sunset burger", mode: "video", durationSec: 8 });
    expect(res.status).toBe(200);
    expect(mocks.planStoryboard).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "sunset burger" }),
    );
    const data = await res.json();
    expect(data.job.promptUsed).toBe("sunset burger sizzling on cast iron, warm rim light, macro lens");
    expect(data.job.promptSource).toBe("groq");
  });

  it("uses accepted prompt directly for planner and shots when enhance=false", async () => {
    const accepted = "accepted sunset burger sizzling, warm amber glow, shallow depth of field";
    const res = await call({ prompt: accepted, enhance: false, mode: "video", durationSec: 8 });
    expect(res.status).toBe(200);
    expect(mocks.enhanceVideoPrompt).not.toHaveBeenCalled();
    expect(mocks.planStoryboard).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: accepted }),
    );
    const data = await res.json();
    expect(data.job.promptUsed).toBe(accepted);
    expect(data.job.promptSource).toBe("user");
  });

  it("uses enhanced prompt for GIF single-shot rendering", async () => {
    const res = await call({ prompt: "sunset burger", mode: "gif", durationSec: 3 });
    expect(res.status).toBe(200);
    expect(mocks.planStoryboard).not.toHaveBeenCalled();
    const shotsArg = mocks.createVideoJob.mock.calls[0]?.[2];
    expect(shotsArg[0].visualPrompt).toBe(
      "sunset burger sizzling on cast iron, warm rim light, macro lens",
    );
  });

  it("returns field-specific zod errors instead of generic message", async () => {
    const badPrompt = await call({ prompt: "hi" });
    expect(badPrompt.status).toBe(400);
    expect((await badPrompt.json()).error).toMatch(/at least 3 characters/i);

    const badDuration = await call({ prompt: "sunset burger", mode: "gif", durationSec: 10 });
    expect(badDuration.status).toBe(400);
    expect((await badDuration.json()).error).toMatch(/1 and 4 seconds for GIFs/i);

    const badRatio = await call({ prompt: "sunset burger", aspectRatio: "4:3" });
    expect(badRatio.status).toBe(400);
    expect((await badRatio.json()).error).toMatch(/16:9, 9:16, or 1:1/i);
  });
});
