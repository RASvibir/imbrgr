import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  consumeRateLimit: vi.fn(),
  assertUserMayUseAi: vi.fn(),
}));

vi.mock("@/lib/request-identity", () => ({ getActor: routeMocks.getActor }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: routeMocks.consumeRateLimit }));
vi.mock("@/lib/user-guards", () => ({ assertUserMayUseAi: routeMocks.assertUserMayUseAi }));

import { handleVideoEnhancePost, type VideoEnhanceProvider } from "@/lib/ai/video-enhance";
import { verifyIntent } from "@/lib/ai/prompt-intent";
import { VIDEO_ENHANCE_SYSTEM, VIDEO_POLISH_SYSTEM, VIDEO_VARIANTS_SYSTEM } from "@/lib/ai/video-prompt";
import { POST } from "./route";

function makeReq(body: unknown) {
  return new Request("http://localhost/api/ai/video/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/video/enhance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.getActor.mockResolvedValue({ userId: null, voterKey: "a:1", ipHash: "guest-ip" });
    routeMocks.consumeRateLimit.mockResolvedValue(1);
    routeMocks.assertUserMayUseAi.mockResolvedValue(null);
  });

  it("works for guests via route POST entrypoint with local fallback", async () => {
    const res = await POST(makeReq({ prompt: "red burger on a grill", preset: "motion" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.original).toBe("red burger on a grill");
    expect(data.source).toBe("local");
    expect(data.improved).toContain("red burger on a grill");
    expect(data.preserved).toEqual(expect.arrayContaining(["red", "burger", "grill"]));
    expect(routeMocks.consumeRateLimit).toHaveBeenCalledWith(
      "ai-video-enhance:guest-ip",
      expect.any(Number),
      3_600_000,
    );
  });

  it("runs isPromptBlocked before rate limit or providers", async () => {
    const providerRun = vi.fn();
    const res = await handleVideoEnhancePost(
      makeReq({ prompt: "nsfw burger scene", preset: "motion" }),
      {
        getActor: routeMocks.getActor,
        consumeRateLimit: routeMocks.consumeRateLimit,
        assertUserMayUseAi: routeMocks.assertUserMayUseAi,
        providers: [{ name: "groq", run: providerRun }],
      },
    );
    expect(res.status).toBe(400);
    expect(routeMocks.consumeRateLimit).not.toHaveBeenCalled();
    expect(providerRun).not.toHaveBeenCalled();
  });

  it("returns 429 when enhance rate limit is exhausted", async () => {
    routeMocks.consumeRateLimit.mockRejectedValueOnce(new Error("Too many enhance requests"));
    const res = await handleVideoEnhancePost(
      makeReq({ prompt: "red burger", preset: "polish" }),
      {
        getActor: async () => ({ userId: "u1", voterKey: "u:u1", ipHash: "h" }),
        consumeRateLimit: routeMocks.consumeRateLimit,
        assertUserMayUseAi: routeMocks.assertUserMayUseAi,
      },
    );
    expect(res.status).toBe(429);
    expect(routeMocks.consumeRateLimit).toHaveBeenCalledWith(
      "ai-video-enhance:u1",
      expect.any(Number),
      3_600_000,
    );
  });

  it("never calls third-party providers when mature=true or safe=false", async () => {
    const providerRun = vi.fn().mockResolvedValue("should not be called");
    const providers: VideoEnhanceProvider[] = [{ name: "groq", run: providerRun }];

    const resMature = await handleVideoEnhancePost(
      makeReq({ prompt: "2 dancers on stage", preset: "variants", mature: true }),
      {
        getActor: routeMocks.getActor,
        consumeRateLimit: routeMocks.consumeRateLimit,
        assertUserMayUseAi: routeMocks.assertUserMayUseAi,
        providers,
      },
    );
    expect(resMature.status).toBe(200);
    const dataMature = await resMature.json();
    expect(dataMature.source).toBe("local");
    expect(dataMature.variants).toHaveLength(3);
    expect(providerRun).not.toHaveBeenCalled();

    const resUnsafe = await handleVideoEnhancePost(
      makeReq({ prompt: "2 dancers on stage", preset: "motion", safe: false }),
      {
        getActor: routeMocks.getActor,
        consumeRateLimit: routeMocks.consumeRateLimit,
        assertUserMayUseAi: routeMocks.assertUserMayUseAi,
        providers,
      },
    );
    expect(resUnsafe.status).toBe(200);
    expect((await resUnsafe.json()).source).toBe("local");
    expect(providerRun).not.toHaveBeenCalled();
  });

  it("uses preset-specific system prompts and honors Camera Motion rule", async () => {
    const seenSystems: string[] = [];
    const provider: VideoEnhanceProvider = {
      name: "groq",
      run: async (_prompt, system) => {
        seenSystems.push(system);
        if (system === VIDEO_POLISH_SYSTEM) return "Red cat on a quiet porch.";
        if (system === VIDEO_VARIANTS_SYSTEM) {
          return JSON.stringify([
            "Red cat stretching on a quiet porch, warm morning sunlight, medium shot",
            "Red cat blinking slowly on a quiet porch, soft golden rim light, shallow depth of field",
            "Red cat flicking its tail on a quiet porch, gentle amber glow, 35mm film look",
          ]);
        }
        return "Red cat stretching slowly on a quiet porch, warm practical light, shallow depth of field";
      },
    };

    const polishRes = await handleVideoEnhancePost(
      makeReq({ prompt: "red cat on quiet porch", preset: "polish" }),
      {
        getActor: routeMocks.getActor,
        consumeRateLimit: routeMocks.consumeRateLimit,
        assertUserMayUseAi: routeMocks.assertUserMayUseAi,
        providers: [provider],
      },
    );
    expect(polishRes.status).toBe(200);
    const polishData = await polishRes.json();
    expect(polishData.source).toBe("groq");
    expect(polishData.improved).toBe("Red cat on a quiet porch.");

    const variantsRes = await handleVideoEnhancePost(
      makeReq({ prompt: "red cat on quiet porch", preset: "variants" }),
      {
        getActor: routeMocks.getActor,
        consumeRateLimit: routeMocks.consumeRateLimit,
        assertUserMayUseAi: routeMocks.assertUserMayUseAi,
        providers: [provider],
      },
    );
    expect(variantsRes.status).toBe(200);
    const variantsData = await variantsRes.json();
    expect(variantsData.variants).toHaveLength(3);
    for (const v of variantsData.variants) {
      expect(verifyIntent("red cat on quiet porch", v).ok).toBe(true);
    }

    const motionRes = await handleVideoEnhancePost(
      makeReq({ prompt: "red cat on quiet porch", preset: "motion", motion: "orbit" }),
      {
        getActor: routeMocks.getActor,
        consumeRateLimit: routeMocks.consumeRateLimit,
        assertUserMayUseAi: routeMocks.assertUserMayUseAi,
        providers: [provider],
      },
    );
    expect(motionRes.status).toBe(200);
    const motionData = await motionRes.json();
    expect(motionData.improved).toMatch(/orbital camera drift/i);
    expect(seenSystems).toEqual([VIDEO_POLISH_SYSTEM, VIDEO_VARIANTS_SYSTEM, VIDEO_ENHANCE_SYSTEM]);
  });

  it("discards drifting LLM output and falls back to local enrichment with rejectedReason", async () => {
    const provider: VideoEnhanceProvider = {
      name: "ollama",
      run: async () => "three blue dogs running in snow",
    };

    const res = await handleVideoEnhancePost(
      makeReq({ prompt: "2 red cats without collars", preset: "motion" }),
      {
        getActor: routeMocks.getActor,
        consumeRateLimit: routeMocks.consumeRateLimit,
        assertUserMayUseAi: routeMocks.assertUserMayUseAi,
        providers: [provider],
      },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("local");
    expect(data.rejectedReason).toBeTruthy();
    expect(data.improved).toContain("2 red cats without collars");
  });

  it("falls back to local enrichment when overall provider chain deadline expires", async () => {
    const slowProvider: VideoEnhanceProvider = {
      name: "ollama",
      run: () => new Promise((resolve) => setTimeout(() => resolve("red burger sizzling"), 500)),
    };
    const secondProviderRun = vi.fn().mockResolvedValue("red burger on grill");

    const res = await handleVideoEnhancePost(
      makeReq({ prompt: "red burger on grill", preset: "motion" }),
      {
        getActor: routeMocks.getActor,
        consumeRateLimit: routeMocks.consumeRateLimit,
        assertUserMayUseAi: routeMocks.assertUserMayUseAi,
        providers: [slowProvider, { name: "groq", run: secondProviderRun }],
        deadlineMs: 25,
      },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("local");
    expect(data.rejectedReason).toMatch(/timed out/i);
    expect(secondProviderRun).not.toHaveBeenCalled();
  });

  it("returns field-specific 400 error on invalid input", async () => {
    const res = await handleVideoEnhancePost(
      makeReq({ prompt: "hi", preset: "motion" }),
      {
        getActor: routeMocks.getActor,
        consumeRateLimit: routeMocks.consumeRateLimit,
        assertUserMayUseAi: routeMocks.assertUserMayUseAi,
      },
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/at least 3 characters/i);
  });
});
