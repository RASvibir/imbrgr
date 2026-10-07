import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/simple-image-edit", () => ({
  simpleImageEdit: vi.fn(async () => Buffer.from("local-png")),
}));

vi.mock("@/lib/ai/pollinations-image-edit", () => ({
  editImageWithPollinations: vi.fn(async () => ({
    buffer: Buffer.from("pollinations-png"),
    mimeType: "image/png",
    model: "kontext",
  })),
}));

vi.mock("@/lib/ai/gemini-image-edit", () => ({
  editImageWithGemini: vi.fn(async () => ({
    buffer: Buffer.from("gemini-png"),
    mimeType: "image/png",
    model: "gemini-test",
  })),
}));

import { editImageWithGemini } from "@/lib/ai/gemini-image-edit";
import { editImageWithPollinations } from "@/lib/ai/pollinations-image-edit";
import { resolveImageEdit } from "@/lib/ai/resolve-image-edit";
import { simpleImageEdit } from "@/lib/simple-image-edit";

const buf = Buffer.from("source");

describe("resolveImageEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.POLLINATIONS_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it("uses local edit for brighten instructions", async () => {
    const r = await resolveImageEdit({ imageBuffer: buf, mimeType: "image/png", instruction: "make it brighter" });
    expect(r.provider).toBe("local");
    expect(simpleImageEdit).toHaveBeenCalledOnce();
    expect(editImageWithPollinations).not.toHaveBeenCalled();
  });

  it("uses Pollinations for content edits when key is set", async () => {
    process.env.POLLINATIONS_API_KEY = "test-key";
    const r = await resolveImageEdit({ imageBuffer: buf, mimeType: "image/png", instruction: "add fairies" });
    expect(r.provider).toBe("pollinations");
    expect(editImageWithPollinations).toHaveBeenCalledOnce();
    expect(simpleImageEdit).not.toHaveBeenCalled();
  });

  it("falls back to Gemini when Pollinations fails", async () => {
    process.env.POLLINATIONS_API_KEY = "test-key";
    process.env.GEMINI_API_KEY = "gem-key";
    vi.mocked(editImageWithPollinations).mockRejectedValueOnce(new Error("pollinations_down"));
    const r = await resolveImageEdit({ imageBuffer: buf, mimeType: "image/png", instruction: "add fairies" });
    expect(r.provider).toBe("gemini");
    expect(editImageWithGemini).toHaveBeenCalledOnce();
  });

  it("throws when AI is required but no provider is configured", async () => {
    await expect(
      resolveImageEdit({ imageBuffer: buf, mimeType: "image/png", instruction: "add fairies" }),
    ).rejects.toThrow(/not configured/i);
  });
});
