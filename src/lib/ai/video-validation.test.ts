import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isDurationValid, VIDEO_LIMITS } from "./video-limits";
import { formatVideoValidationErrors } from "./video-validation";

const jobSchema = z
  .object({
    prompt: z.string().min(3).max(500),
    mode: z.enum(["gif", "video"]).optional(),
    durationSec: z.number().min(VIDEO_LIMITS.gif.minSec).max(VIDEO_LIMITS.video.maxSec).optional(),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
  })
  .refine((v) => v.durationSec == null || isDurationValid(v.mode ?? "video", v.durationSec), {
    message: "Duration out of range for this mode",
    path: ["durationSec"],
  });

describe("formatVideoValidationErrors", () => {
  it("reports specific messages for prompt length, duration range, and aspect ratio", () => {
    const shortPrompt = jobSchema.safeParse({ prompt: "ab" });
    expect(shortPrompt.success).toBe(false);
    if (!shortPrompt.success) {
      const res = formatVideoValidationErrors(shortPrompt.error);
      expect(res.message).toMatch(/at least 3 characters/i);
      expect(res.fields.prompt).toMatch(/at least 3 characters/i);
    }

    const longPrompt = jobSchema.safeParse({ prompt: "x".repeat(501) });
    expect(longPrompt.success).toBe(false);
    if (!longPrompt.success) {
      expect(formatVideoValidationErrors(longPrompt.error).message).toMatch(/500 characters/i);
    }

    const badDuration = jobSchema.safeParse({ prompt: "valid prompt", mode: "gif", durationSec: 9 });
    expect(badDuration.success).toBe(false);
    if (!badDuration.success) {
      expect(formatVideoValidationErrors(badDuration.error, "gif").message).toMatch(
        /1 and 4 seconds for GIFs/i,
      );
    }

    const badRatio = jobSchema.safeParse({ prompt: "valid prompt", aspectRatio: "4:3" });
    expect(badRatio.success).toBe(false);
    if (!badRatio.success) {
      expect(formatVideoValidationErrors(badRatio.error).message).toMatch(/16:9, 9:16, or 1:1/i);
    }
  });
});
