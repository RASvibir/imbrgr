import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { defaultImageProvider } from "@/lib/ai/image-provider";
import { buildFluxPrompt } from "@/lib/ai/image-prompt";
import { enhancePrompt } from "@/lib/ai/prompt-enhance";
import {
  assertCanGenerateAi,
  generationsNeededForRequest,
  getAiUsageToday,
  recordAiGenerationSuccess,
} from "@/lib/ai/usage";
import { processAndStoreUpload } from "@/lib/media-save";

const schema = z.object({
  prompt: z.string().min(3).max(500),
  enhance: z.boolean().optional(),
  width: z.number().int().min(512).max(1536).optional(),
  height: z.number().int().min(512).max(1536).optional(),
  seed: z.number().int().min(0).optional(),
  style: z.string().max(40).optional(),
  safe: z.boolean().optional(),
  variations: z.number().int().min(1).max(4).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const needed = generationsNeededForRequest({ variations: parsed.data.variations });

  try {
    await assertCanGenerateAi(session.user.id, needed);
    const usageBefore = await getAiUsageToday(session.user.id);

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

    const results: {
      mediaShortId: string;
      storageKey: string;
      seed: number;
    }[] = [];

    for (let i = 0; i < needed; i++) {
      const seed = parsed.data.seed != null ? baseSeed + i : baseSeed + i * 9973;
      const gen = await defaultImageProvider.generate({
        prompt: fullPrompt,
        width,
        height,
        seed,
        safe: parsed.data.safe ?? true,
      });

      const media = await processAndStoreUpload({
        buffer: gen.buffer,
        mime: gen.mimeType,
        userId: session.user.id,
        voterKey: null,
        aiGenerated: true,
        aiPrompt: fullPrompt,
        losslessPng: true,
      });

      results.push({
        mediaShortId: media.shortId,
        storageKey: media.storageKey,
        seed: gen.seed,
      });
    }

    await recordAiGenerationSuccess(session.user.id, needed);
    const usageAfter = await getAiUsageToday(session.user.id);

    const primary = results[0];
    return NextResponse.json({
      mediaShortId: primary.mediaShortId,
      storageKey: primary.storageKey,
      prompt: fullPrompt,
      enhanceSource,
      imageProvider: "pollinations",
      seeds: results.map((r) => r.seed),
      variations: results,
      usage: usageAfter,
      checkedAt: usageBefore,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    const status = msg.includes("Daily AI") ? 429 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
