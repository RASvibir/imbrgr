import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAiVideo, buildCinematicVideoPrompt } from "@/lib/ai/video-provider";
import {
  assertCanGenerateAiForAnonymous,
  assertCanGenerateAiForUser,
  recordAiGenerationSuccess,
  recordAnonymousAiSuccess,
} from "@/lib/ai/usage";
import { aiRateLimitPerHour } from "@/lib/config";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/request-identity";
import { assertUserMayUseAi } from "@/lib/user-guards";
import { consumeRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const schema = z.object({
  prompt: z.string().min(3).max(500),
  sourceImageUrl: z.string().url().or(z.string().startsWith("data:")).optional(),
  motion: z
    .enum(["zoom-in", "zoom-out", "pan-right", "pan-left", "orbit", "pulse", "dramatic"])
    .optional(),
  durationSec: z.number().min(1).max(10).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
  style: z.string().max(40).optional(),
  seed: z.number().int().min(0).optional(),
  safe: z.boolean().optional(),
  mature: z.boolean().optional(),
});

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

  // Check if source image is an internal media marked mature
  let sourceIsMature = false;
  if (parsed.data.sourceImageUrl) {
    const match = parsed.data.sourceImageUrl.match(/(?:\/m\/|\/media\/|\/file\/|^)([a-zA-Z0-9_-]{4,20})/);
    if (match) {
      const sourceMedia = await prisma.media.findFirst({
        where: { shortId: match[1] },
        select: { mature: true },
      });
      if (sourceMedia?.mature) {
        sourceIsMature = true;
      }
    }
  }

  const matureRequested = parsed.data.safe === false || parsed.data.mature === true || sourceIsMature;
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

  try {
    const video = await generateAiVideo({
      ...parsed.data,
      safe: !matureRequested,
      mature: matureRequested,
    });

    if (actor.userId) {
      await recordAiGenerationSuccess(actor.userId, 1);
    } else {
      await recordAnonymousAiSuccess(actor.ipHash, 1);
    }

    return NextResponse.json({ success: true, video: { ...video, mature: matureRequested } });
  } catch (err) {
    console.error("[imbrgr/ai-video] generate error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Video generation failed" },
      { status: 500 },
    );
  }
}
