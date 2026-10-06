import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultImageProvider } from "@/lib/ai/image-provider";
import { buildFluxPrompt } from "@/lib/ai/image-prompt";
import { aiMockEnabled, mockImageBuffer } from "@/lib/ai/mock";
import { enhancePrompt } from "@/lib/ai/prompt-enhance";
import {
  assertCanGenerateAiForAnonymous,
  assertCanGenerateAiForUser,
  generationsNeededForRequest,
  getAiUsageToday,
  getAnonymousAiUsageToday,
  recordAiGenerationSuccess,
  recordAnonymousAiSuccess,
} from "@/lib/ai/usage";
import { aiRateLimitPerHour } from "@/lib/config";
import { processAndStoreUpload } from "@/lib/media-save";
import { getActor } from "@/lib/request-identity";
import { friendlyError } from "@/lib/user-messages";
import { assertUserMayUseAi } from "@/lib/user-guards";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { Visibility } from "@/lib/visibility";

const schema = z.object({
  prompt: z.string().min(3).max(500),
  enhance: z.boolean().optional(),
  width: z.number().int().min(512).max(1536).optional(),
  height: z.number().int().min(512).max(1536).optional(),
  seed: z.number().int().min(0).optional(),
  style: z.string().max(40).optional(),
  safe: z.boolean().optional(),
  variations: z.number().int().min(1).max(4).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED"]).optional(),
});

export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const needed = generationsNeededForRequest({ variations: parsed.data.variations });
  const rateKey = `ai:${actor.userId ?? actor.ipHash}`;
  try {
    const aiBlock = await assertUserMayUseAi(actor.userId);
    if (aiBlock) return NextResponse.json({ error: aiBlock }, { status: 403 });
    await consumeRateLimit(rateKey, aiRateLimitPerHour(), 60 * 60 * 1000);
    if (actor.userId) {
      await assertCanGenerateAiForUser(actor.userId, needed);
    } else {
      await assertCanGenerateAiForAnonymous(actor.ipHash, needed);
    }
    const usageBefore = actor.userId
      ? await getAiUsageToday(actor.userId)
      : await getAnonymousAiUsageToday(actor.ipHash);

    let prompt = parsed.data.prompt;
    let enhanceSource: string | undefined;
    if (parsed.data.enhance) {
      const enhanced = await enhancePrompt(prompt, { style: parsed.data.style });
      prompt = enhanced.prompt;
      enhanceSource = enhanced.source;
    }

    const fullPrompt = buildFluxPrompt(prompt, parsed.data.style);
    const width = parsed.data.width ?? 1024;
    const height = parsed.data.height ?? 1024;
    const baseSeed = parsed.data.seed ?? Math.floor(Math.random() * 2_147_483_647);
    const vis = (parsed.data.visibility ?? "UNLISTED") as Visibility;

    const results: { mediaShortId: string; storageKey: string; seed: number; deleteToken?: string | null }[] = [];

    for (let i = 0; i < needed; i++) {
      const seed = parsed.data.seed != null ? baseSeed + i : baseSeed + i * 9973;
      let buffer: Buffer;
      if (aiMockEnabled()) {
        buffer = await mockImageBuffer();
      } else {
        const gen = await defaultImageProvider.generate({
          prompt: fullPrompt,
          width,
          height,
          seed,
          safe: parsed.data.safe ?? true,
        });
        buffer = gen.buffer;
      }

      const media = await processAndStoreUpload({
        buffer,
        mime: "image/png",
        userId: actor.userId,
        voterKey: actor.userId ? null : actor.voterKey,
        aiGenerated: true,
        aiPrompt: fullPrompt,
        losslessPng: true,
        visibility: actor.userId ? vis : vis,
      });

      results.push({
        mediaShortId: media.shortId,
        storageKey: media.storageKey,
        seed,
        deleteToken: media.deleteToken ?? undefined,
      });
    }

    if (actor.userId) await recordAiGenerationSuccess(actor.userId, needed);
    else await recordAnonymousAiSuccess(actor.ipHash, needed);

    const usageAfter = actor.userId
      ? await getAiUsageToday(actor.userId)
      : await getAnonymousAiUsageToday(actor.ipHash);

    const primary = results[0];
    return NextResponse.json({
      mediaShortId: primary.mediaShortId,
      storageKey: primary.storageKey,
      deleteToken: primary.deleteToken,
      prompt: fullPrompt,
      enhanceSource,
      imageProvider: aiMockEnabled() ? "mock" : "pollinations",
      seeds: results.map((r) => r.seed),
      variations: results,
      usage: usageAfter,
      checkedAt: usageBefore,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Generation failed";
    const status = raw.includes("resting") || raw.includes("plating") ? 429 : 400;
    return NextResponse.json({ error: friendlyError(raw) }, { status });
  }
}
