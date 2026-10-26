import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCinematicVideoPrompt } from "@/lib/ai/video-provider";
import { clampVideoDuration, isDurationValid, VIDEO_LIMITS } from "@/lib/ai/video-limits";
import { plannerAvailable, planStoryboard } from "@/lib/ai/director/planner";
import { PLAN_MIN_SEC, type Storyboard } from "@/lib/ai/director/types";
import { consumePlanLimits } from "@/lib/ai/director/limits";
import { assertCanGenerateAiForAnonymous, assertCanGenerateAiForUser } from "@/lib/ai/usage";
import { planShots } from "@/lib/ai/video-job/shots";
import { createVideoJob, serializeJob } from "@/lib/ai/video-job/service";
import type { JobInput } from "@/lib/ai/video-job/types";
import { aiRateLimitPerHour } from "@/lib/config";
import { getActor } from "@/lib/request-identity";
import { assertUserMayUseAi } from "@/lib/user-guards";
import { consumeRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const schema = z
  .object({
    prompt: z.string().min(3).max(500),
    motion: z
      .enum(["zoom-in", "zoom-out", "pan-right", "pan-left", "orbit", "pulse", "dramatic"])
      .optional(),
    mode: z.enum(["gif", "video"]).optional(),
    durationSec: z.number().min(VIDEO_LIMITS.gif.minSec).max(VIDEO_LIMITS.video.maxSec).optional(),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
    style: z.string().max(40).optional(),
    seed: z.number().int().min(0).optional(),
    safe: z.boolean().optional(),
    mature: z.boolean().optional(),
  })
  .refine((v) => v.durationSec == null || isDurationValid(v.mode ?? "video", v.durationSec), {
    message: "Duration out of range for this mode",
    path: ["durationSec"],
  });

/** Creates a generation job. Shots are rendered one per call to /jobs/:id/step. */
export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid video generation request" }, { status: 400 });
  }

  const { isPromptBlocked, blockedPromptMessage } = await import("@/lib/prompt-safety");
  const fullPrompt = buildCinematicVideoPrompt(parsed.data.prompt, parsed.data.style);
  if (isPromptBlocked(parsed.data.prompt) || isPromptBlocked(fullPrompt)) {
    return NextResponse.json({ error: blockedPromptMessage }, { status: 400 });
  }

  const matureRequested = parsed.data.safe === false || parsed.data.mature === true;
  if (matureRequested && !actor.userId) {
    return NextResponse.json(
      { error: "Sign in required: mature AI videos are only available to signed-in users." },
      { status: 403 },
    );
  }

  const rateKey = `ai-video:${actor.userId ?? actor.ipHash}`;
  try {
    const aiBlock = await assertUserMayUseAi(actor.userId);
    if (aiBlock) return NextResponse.json({ error: aiBlock }, { status: 403 });

    await consumeRateLimit(rateKey, aiRateLimitPerHour(), 60 * 60 * 1000);

    if (actor.userId) {
      await assertCanGenerateAiForUser(actor.userId, 1);
    } else {
      await assertCanGenerateAiForAnonymous(actor.ipHash, 1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rate limit or quota exceeded";
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const mode = parsed.data.mode ?? "video";
  const input: JobInput = {
    prompt: parsed.data.prompt,
    style: parsed.data.style,
    aspectRatio: parsed.data.aspectRatio ?? "16:9",
    mode,
    durationSec: clampVideoDuration(mode, parsed.data.durationSec),
    motion: parsed.data.motion ?? "zoom-in",
    seed: parsed.data.seed ?? Math.floor(Math.random() * 2_147_483_647),
    mature: matureRequested,
  };

  let storyboard: Storyboard | null = null;
  if (!matureRequested && mode === "video" && plannerAvailable()) {
    try {
      const limit = await consumePlanLimits(actor);
      if (limit.ok) {
        const planned = await planStoryboard({
          prompt: input.prompt,
          targetSec: Math.max(input.durationSec, PLAN_MIN_SEC),
          aspectRatio: input.aspectRatio,
          style: input.style,
        });
        storyboard = planned.storyboard;
      }
    } catch (err) {
      console.error("[imbrgr/ai-video] planning fell back to a single shot", err);
    }
  }

  try {
    const job = await createVideoJob(actor, input, planShots(input, storyboard));
    return NextResponse.json({ success: true, job: serializeJob(job, { images: false }) });
  } catch (err) {
    console.error("[imbrgr/ai-video] job create error", err);
    return NextResponse.json({ error: "Video generation failed" }, { status: 500 });
  }
}
