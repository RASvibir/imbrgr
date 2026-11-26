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
  resolveContinuation: vi.fn(),
  selectBackend: vi.fn(),
  pollinationsEnabled: vi.fn(),
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
vi.mock("@/lib/ai/video-provider", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/video-provider")>();
  return { ...actual, pollinationsAssembledEnabled: mocks.pollinationsEnabled };
});
vi.mock("@/lib/ai/video-job/backend", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/video-job/backend")>();
  return { ...actual, selectBackend: mocks.selectBackend };
});
vi.mock("@/lib/ai/video-job/service", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/video-job/service")>();
  return {
    ...actual,
    createVideoJob: mocks.createVideoJob,
    resolveContinuation: mocks.resolveContinuation,
  };
});

import { POST } from "./route";

function assembledBackend(supportsContinuation = true) {
  return {
    name: supportsContinuation ? "assembled-stills" : "no-continue",
    tier: 1,
    supportsContinuation,
    isConfigured: () => true,
    renderShot: vi.fn(),
  };
}

describe("POST /api/ai/video/jobs prompt-assist behavior", () => {
  function call(body: unknown) {
    return POST(
      new Request("http://localhost/api/ai/video/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActor.mockResolvedValue({ userId: "u1", voterKey: "u:u1", ipHash: "h" });
    mocks.selectBackend.mockReturnValue(assembledBackend());
    mocks.pollinationsEnabled.mockReturnValue(false);
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

describe("POST /api/ai/video/jobs continuation", () => {
  function postReq(body: Record<string, unknown>) {
    return new Request("http://localhost/api/ai/video/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActor.mockResolvedValue({ userId: "user1", voterKey: "u:user1", ipHash: "h1" });
    mocks.assertUserMayUseAi.mockResolvedValue(null);
    mocks.consumeRateLimit.mockResolvedValue(undefined);
    mocks.assertCanGenerateAiForUser.mockResolvedValue(undefined);
    mocks.assertCanGenerateAiForAnonymous.mockResolvedValue(undefined);
    mocks.plannerAvailable.mockReturnValue(false);
    mocks.enhanceVideoPrompt.mockImplementation(async (p: string) => ({ prompt: p }));
    mocks.selectBackend.mockReturnValue(assembledBackend());
    mocks.pollinationsEnabled.mockReturnValue(true);
    mocks.resolveContinuation.mockResolvedValue({
      ok: true,
      lastFrame: "https://blob.example/frame.jpg",
      lastFrameSource: "client",
    });
    mocks.createVideoJob.mockImplementation(async (_actor, input, shots) => ({
      id: "job-next",
      ownerKey: "u:user1",
      userId: "user1",
      ipHash: null,
      status: "queued",
      input,
      shots,
      nextShot: 0,
      error: null,
    }));
  });

  it("allows continuation on a tier-1 backend that declares supportsContinuation", async () => {
    const res = await POST(
      postReq({ prompt: "pan up to neon sign", parentJobId: "job-prev", continueMode: "next-shot", durationSec: 13 }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    const [, input, shots] = mocks.createVideoJob.mock.calls[0];
    expect(input.parentJobId).toBe("job-prev");
    expect(shots).toHaveLength(2);
    expect(shots[0].seedImage).toBe("https://blob.example/frame.jpg");
    expect(shots[0].seedImageSource).toBe("client");
    expect(shots.every((s: { stockQuery?: string }) => s.stockQuery === undefined)).toBe(true);
    expect(shots.reduce((acc: number, s: { durationSec: number }) => acc + s.durationSec, 0)).toBe(13);
  });

  it("creates prompt-only continuation jobs for guests without a seed image", async () => {
    mocks.getActor.mockResolvedValueOnce({ userId: null, voterKey: "a:guest", ipHash: "h1" });
    mocks.resolveContinuation.mockResolvedValueOnce({ ok: true, promptOnly: true });
    const res = await POST(
      postReq({ prompt: "pan up to neon sign", parentJobId: "job-prev", continueMode: "extend", durationSec: 5 }),
    );
    expect(res.status).toBe(200);
    const [, input, shots] = mocks.createVideoJob.mock.calls[0];
    expect(input.parentJobId).toBe("job-prev");
    expect(shots[0].seedImage).toBeUndefined();
    expect(shots[0].seedImageSource).toBeUndefined();
  });

  it("returns 409 when the configured backend does not support continuation", async () => {
    mocks.selectBackend.mockReturnValue(assembledBackend(false));
    const res = await POST(postReq({ prompt: "continue", parentJobId: "job-prev" }));
    expect(res.status).toBe(409);
    expect(mocks.createVideoJob).not.toHaveBeenCalled();
  });

  it("rejects mature continuation requests", async () => {
    const res = await POST(postReq({ prompt: "continue", parentJobId: "job-prev", mature: true }));
    expect(res.status).toBe(400);
    expect(mocks.createVideoJob).not.toHaveBeenCalled();
  });

  it("propagates 404 when parent job is missing or owned by someone else", async () => {
    mocks.resolveContinuation.mockResolvedValueOnce({ ok: false, status: 404, error: "Video job not found" });
    const res = await POST(postReq({ prompt: "continue", parentJobId: "other-job" }));
    expect(res.status).toBe(404);
  });
});
