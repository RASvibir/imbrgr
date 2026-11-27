import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  enhanceVideoPrompt: vi.fn(),
  generateAiVideo: vi.fn(),
  consumeRateLimit: vi.fn(),
  assertUserMayUseAi: vi.fn(),
  assertCanGenerateAiForUser: vi.fn(),
  assertCanGenerateAiForAnonymous: vi.fn(),
  recordAiGenerationSuccess: vi.fn(),
  recordAnonymousAiSuccess: vi.fn(),
  findMedia: vi.fn(),
}));

vi.mock("@/lib/request-identity", () => ({ getActor: mocks.getActor }));
vi.mock("@/lib/ai/prompt-enhance", () => ({ enhanceVideoPrompt: mocks.enhanceVideoPrompt }));
vi.mock("@/lib/ai/video-generate", () => ({ generateAiVideo: mocks.generateAiVideo }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock("@/lib/user-guards", () => ({ assertUserMayUseAi: mocks.assertUserMayUseAi }));
vi.mock("@/lib/ai/usage", () => ({
  assertCanGenerateAiForUser: mocks.assertCanGenerateAiForUser,
  assertCanGenerateAiForAnonymous: mocks.assertCanGenerateAiForAnonymous,
  recordAiGenerationSuccess: mocks.recordAiGenerationSuccess,
  recordAnonymousAiSuccess: mocks.recordAnonymousAiSuccess,
}));
vi.mock("@/lib/db", () => ({ prisma: { media: { findFirst: mocks.findMedia } } }));

import { POST } from "./route";

function call(body: unknown) {
  return POST(
    new Request("http://localhost/api/ai/video/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/ai/video/generate safety and validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActor.mockResolvedValue({ userId: "u1", voterKey: "u:u1", ipHash: "h" });
    mocks.assertUserMayUseAi.mockResolvedValue(null);
    mocks.consumeRateLimit.mockResolvedValue(1);
    mocks.assertCanGenerateAiForUser.mockResolvedValue(undefined);
    mocks.assertCanGenerateAiForAnonymous.mockResolvedValue(undefined);
    mocks.recordAiGenerationSuccess.mockResolvedValue(undefined);
    mocks.findMedia.mockResolvedValue(null);
    mocks.enhanceVideoPrompt.mockResolvedValue({ prompt: "enhanced", source: "groq" });
    mocks.generateAiVideo.mockResolvedValue({
      previewUrl: "data:image/png;base64,AA",
      motion: "zoom-in",
      durationSec: 8,
      fps: 24,
      width: 1280,
      height: 720,
      provider: "mock",
      seed: 1,
    });
  });

  it("checks isPromptBlocked before enhanceVideoPrompt", async () => {
    const res = await call({ prompt: "nsfw clip" });
    expect(res.status).toBe(400);
    expect(mocks.enhanceVideoPrompt).not.toHaveBeenCalled();
  });

  it("skips third-party enhance when mature=true and uses local enrichment", async () => {
    const res = await call({ prompt: "sunset burger", mature: true });
    expect(res.status).toBe(200);
    expect(mocks.enhanceVideoPrompt).not.toHaveBeenCalled();
    expect(mocks.generateAiVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("sunset burger"),
        mature: true,
      }),
    );
  });

  it("returns field-specific validation error on bad prompt length", async () => {
    const res = await call({ prompt: "ab" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least 3 characters/i);
  });
});
