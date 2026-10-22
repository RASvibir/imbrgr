import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAiVideo } from "@/lib/ai/video-provider";
import {
  assertCanGenerateAiForAnonymous,
  assertCanGenerateAiForUser,
  recordAiGenerationSuccess,
  recordAnonymousAiSuccess,
} from "@/lib/ai/usage";
import { aiRateLimitPerHour } from "@/lib/config";
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
});

export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid video generation request" }, { status: 400 });
  }

  const { isPromptBlocked, blockedPromptMessage } = await import("@/lib/prompt-safety");
  if (isPromptBlocked(parsed.data.prompt)) {
    return NextResponse.json({ error: blockedPromptMessage }, { status: 400 });
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
    const video = await generateAiVideo(parsed.data);

    if (actor.userId) {
      await recordAiGenerationSuccess(actor.userId, 1);
    } else {
      await recordAnonymousAiSuccess(actor.ipHash, 1);
    }

    return NextResponse.json({ success: true, video });
  } catch (err) {
    console.error("[imbrgr/ai-video] generate error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Video generation failed" },
      { status: 500 },
    );
  }
}
