import { NextResponse } from "next/server";
import { z } from "zod";
import { enhanceVideoPrompt } from "@/lib/ai/prompt-enhance";
import { enrichVideoPromptLocal } from "@/lib/ai/video-prompt";
import {
  buildCinematicVideoPrompt,
  pollinationsAssembledEnabled,
  pollinationsMaxClipSec,
} from "@/lib/ai/video-provider";
import { clampVideoDuration, isDurationValid, VIDEO_LIMITS } from "@/lib/ai/video-limits";
import { formatVideoValidationErrors } from "@/lib/ai/video-validation";
import { plannerAvailable, planStoryboard } from "@/lib/ai/director/planner";
import { PLAN_MIN_SEC, type Storyboard } from "@/lib/ai/director/types";
import { consumePlanLimits } from "@/lib/ai/director/limits";
import { getCachedStoryboard, setCachedStoryboard } from "@/lib/ai/director/plan-cache";
import { assertCanGenerateAiForAnonymous, assertCanGenerateAiForUser } from "@/lib/ai/usage";
import { planAssembledShots, planGpuShots } from "@/lib/ai/video-job/shots";
import { backendSupportsContinuation, selectBackend } from "@/lib/ai/video-job/backend";
import { gpuMaxClipSec } from "@/lib/ai/gpu/client";
import { createVideoJob, resolveContinuation, serializeJob } from "@/lib/ai/video-job/service";
import type { JobInput, LastFrameSource } from "@/lib/ai/video-job/types";
import { aiRateLimitPerHour } from "@/lib/config";
import { getActor } from "@/lib/request-identity";
import { assertUserMayUseAi } from "@/lib/user-guards";
import { consumeRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const schema = z
  .object({
    prompt: z.string().min(3).max(500),
    enhance: z.boolean().optional(),
    motion: z
      .enum(["zoom-in", "zoom-out", "pan-right", "pan-left", "orbit", "pulse", "dramatic"])
      .optional(),
    characterMotion: z.enum(["idle", "walk", "emote"]).optional(),
    mode: z.enum(["gif", "video"]).optional(),
    durationSec: z.number().min(VIDEO_LIMITS.gif.minSec).max(VIDEO_LIMITS.video.maxSec).optional(),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
    style: z.string().max(40).optional(),
    seed: z.number().int().min(0).optional(),
    safe: z.boolean().optional(),
    mature: z.boolean().optional(),
    parentJobId: z.string().min(1).max(64).optional(),
    continueMode: z.enum(["extend", "next-shot"]).optional(),
  })
  .refine((v) => v.durationSec == null || isDurationValid(v.mode ?? "video", v.durationSec), {
    message: "Duration out of range for this mode",
    path: ["durationSec"],
  });

/** Creates a generation job. Shots are rendered one per call to /jobs/:id/step. */
export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const formatted = formatVideoValidationErrors(parsed.error, body?.mode);
    return NextResponse.json(
      { error: formatted.message, fieldErrors: formatted.fields },
      { status: 400 },
    );
  }

  const { isPromptBlocked, blockedPromptMessage } = await import("@/lib/prompt-safety");
  const rawPrompt = parsed.data.prompt.trim();
  if (isPromptBlocked(rawPrompt) || isPromptBlocked(parsed.data.style ?? "")) {
    return NextResponse.json({ error: blockedPromptMessage }, { status: 400 });
  }

  const matureRequested = parsed.data.safe === false || parsed.data.mature === true;
  if (matureRequested && !actor.userId) {
    return NextResponse.json(
      { error: "Sign in required: mature AI videos are only available to signed-in users." },
      { status: 403 },
    );
  }

  const backend = selectBackend();
  let seedImage: string | undefined;
  let seedImageSource: LastFrameSource | undefined;
  if (parsed.data.parentJobId) {
    if (matureRequested) {
      return NextResponse.json({ error: "Mature clips can't be continued." }, { status: 400 });
    }
    if (!backendSupportsContinuation(backend)) {
      return NextResponse.json({ error: "The configured video backend doesn't support continuing a clip." }, { status: 409 });
    }
    const continuation = await resolveContinuation(parsed.data.parentJobId, actor);
    if (!continuation.ok) {
      return NextResponse.json({ error: continuation.error }, { status: continuation.status });
    }
    seedImage = continuation.lastFrame;
    seedImageSource = continuation.lastFrameSource;
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

  let prompt = rawPrompt;
  let promptSource = "user";
  if (parsed.data.enhance !== false) {
    if (matureRequested) {
      // Mature prompts must never be forwarded to third-party LLM providers.
      prompt = enrichVideoPromptLocal(rawPrompt, {
        motion: parsed.data.motion,
        characterMotion: parsed.data.characterMotion,
      });
      promptSource = prompt === rawPrompt ? "skip" : "local";
    } else {
      try {
        const enhanced = await enhanceVideoPrompt(rawPrompt, {
          style: parsed.data.style,
          motion: parsed.data.motion,
          characterMotion: parsed.data.characterMotion,
        });
        prompt = enhanced.prompt;
        promptSource = enhanced.source;
      } catch {
        promptSource = "passthrough";
      }
    }
  }
  const fullPrompt = buildCinematicVideoPrompt(prompt, parsed.data.style);
  if (isPromptBlocked(prompt) || isPromptBlocked(fullPrompt)) {
    return NextResponse.json({ error: blockedPromptMessage }, { status: 400 });
  }

  const mode = parsed.data.mode ?? "video";
  const input: JobInput = {
    prompt,
    originalPrompt: rawPrompt,
    promptSource,
    style: parsed.data.style,
    aspectRatio: parsed.data.aspectRatio ?? "16:9",
    mode,
    durationSec: clampVideoDuration(mode, parsed.data.durationSec),
    motion: parsed.data.motion ?? "zoom-in",
    characterMotion: parsed.data.characterMotion,
    seed: parsed.data.seed ?? Math.floor(Math.random() * 2_147_483_647),
    mature: matureRequested,
    parentJobId: parsed.data.parentJobId,
    continueMode: parsed.data.parentJobId ? (parsed.data.continueMode ?? "next-shot") : undefined,
  };

  let storyboard: Storyboard | null = null;
  if (!matureRequested && mode === "video" && plannerAvailable()) {
    try {
      const planParams = {
        prompt: input.originalPrompt ?? input.prompt,
        targetSec: Math.max(input.durationSec, PLAN_MIN_SEC),
        aspectRatio: input.aspectRatio,
        style: input.style,
      };
      storyboard = await getCachedStoryboard(planParams);
      if (!storyboard) {
        const limit = await consumePlanLimits(actor);
        if (limit.ok) {
          const planned = await planStoryboard(planParams);
          storyboard = planned.storyboard;
          await setCachedStoryboard(planParams, storyboard);
        }
      }
    } catch (err) {
      console.error("[imbrgr/ai-video] planning fell back to a single shot", err);
    }
  }

  try {
    const useGpu = !matureRequested && backend.tier === 3;
    const maxClipSec = !matureRequested && pollinationsAssembledEnabled() ? pollinationsMaxClipSec() : undefined;
    const planned = useGpu
      ? planGpuShots(input, storyboard, gpuMaxClipSec())
      : planAssembledShots(input, storyboard, { maxClipSec });
    const shots = seedImage
      ? planned.map((s, i) =>
          i === 0
            ? { ...s, seedImage, ...(seedImageSource ? { seedImageSource } : {}) }
            : s,
        )
      : planned;
    const job = await createVideoJob(actor, input, shots);
    return NextResponse.json({ success: true, job: serializeJob(job, { images: false }) });
  } catch (err) {
    console.error("[imbrgr/ai-video] job create error", err);
    return NextResponse.json({ error: "Video generation failed" }, { status: 500 });
  }
}
