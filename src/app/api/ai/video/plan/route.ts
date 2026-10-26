import { NextResponse } from "next/server";
import { z } from "zod";
import { aiRateLimitPerHour, videoPlanGlobalDailyLimit } from "@/lib/config";
import {
  PlannerFailedError,
  PlannerNotConfiguredError,
  plannerAvailable,
  planStoryboard,
} from "@/lib/ai/director/planner";
import { PLAN_MAX_SEC, PLAN_MIN_SEC } from "@/lib/ai/director/types";
import { getActor } from "@/lib/request-identity";
import { assertUserMayUseAi } from "@/lib/user-guards";
import { consumeRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const schema = z.object({
  prompt: z.string().min(3).max(500),
  targetSec: z.number().min(PLAN_MIN_SEC).max(PLAN_MAX_SEC).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
  style: z.string().max(40).optional(),
  safe: z.boolean().optional(),
  mature: z.boolean().optional(),
});

/**
 * Turn an idea into a storyboard (script + shot list) using a free-tier LLM provider chain.
 * Planning does not count against the daily generation quota; it has its own hourly and global caps.
 */
export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid storyboard request" }, { status: 400 });
  }

  // Mature content is never forwarded to third-party free-tier providers.
  if (parsed.data.mature === true || parsed.data.safe === false) {
    return NextResponse.json(
      { error: "Storyboard planning is only available for family-friendly videos." },
      { status: 400 },
    );
  }

  const { isPromptBlocked, blockedPromptMessage } = await import("@/lib/prompt-safety");
  if (isPromptBlocked(parsed.data.prompt) || isPromptBlocked(parsed.data.style ?? "")) {
    return NextResponse.json({ error: blockedPromptMessage }, { status: 400 });
  }

  if (!plannerAvailable()) {
    return NextResponse.json({ error: "Storyboard planning isn't available right now." }, { status: 503 });
  }

  try {
    const aiBlock = await assertUserMayUseAi(actor.userId);
    if (aiBlock) return NextResponse.json({ error: aiBlock }, { status: 403 });

    await consumeRateLimit(`ai-video-plan:${actor.userId ?? actor.ipHash}`, aiRateLimitPerHour(), 60 * 60 * 1000);
    await consumeRateLimit("ai-video-plan:global", videoPlanGlobalDailyLimit(), 24 * 60 * 60 * 1000);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rate limit or quota exceeded";
    return NextResponse.json({ error: message }, { status: 429 });
  }

  try {
    const result = await planStoryboard({
      prompt: parsed.data.prompt,
      targetSec: parsed.data.targetSec ?? 20,
      aspectRatio: parsed.data.aspectRatio,
      style: parsed.data.style,
    });
    return NextResponse.json({ success: true, storyboard: result.storyboard, provider: result.provider });
  } catch (err) {
    if (err instanceof PlannerNotConfiguredError) {
      return NextResponse.json({ error: "Storyboard planning isn't available right now." }, { status: 503 });
    }
    if (err instanceof PlannerFailedError) {
      return NextResponse.json(
        { error: "We couldn't plan that one — try rephrasing your idea." },
        { status: 502 },
      );
    }
    console.error("[imbrgr/video-plan] unexpected error", err);
    return NextResponse.json({ error: "Storyboard planning failed." }, { status: 500 });
  }
}
