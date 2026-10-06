import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { defaultImageProvider } from "@/lib/ai/image-provider";
import { enhancePrompt } from "@/lib/ai/prompt-enhance";
import { assertCanGenerateAi, getAiUsageToday, recordAiGenerationSuccess } from "@/lib/ai/usage";
import { processAndStoreUpload } from "@/lib/media-save";

const schema = z.object({
  prompt: z.string().min(3).max(500),
  enhance: z.boolean().optional(),
  width: z.number().int().min(256).max(1536).optional(),
  height: z.number().int().min(256).max(1536).optional(),
  seed: z.number().int().optional(),
  style: z.string().max(40).optional(),
  safe: z.boolean().optional(),
});

const STYLES: Record<string, string> = {
  photo: "photorealistic, cinematic lighting",
  anime: "anime illustration style",
  ember: "warm ember orange glow, high contrast",
  sketch: "pencil sketch, crosshatching",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    await assertCanGenerateAi(session.user.id);
    const usageBefore = await getAiUsageToday(session.user.id);

    let prompt = parsed.data.prompt;
    let enhanceSource: string | undefined;
    if (parsed.data.enhance) {
      const enhanced = await enhancePrompt(prompt);
      prompt = enhanced.prompt;
      enhanceSource = enhanced.source;
    }
    const styleSuffix = parsed.data.style ? STYLES[parsed.data.style] : undefined;
    const fullPrompt = styleSuffix ? `${prompt}, ${styleSuffix}` : prompt;

    const width = parsed.data.width ?? 1024;
    const height = parsed.data.height ?? 1024;
    const gen = await defaultImageProvider.generate({
      prompt: fullPrompt,
      width,
      height,
      seed: parsed.data.seed,
      safe: parsed.data.safe ?? true,
    });

    const media = await processAndStoreUpload({
      buffer: gen.buffer,
      mime: gen.mimeType,
      userId: session.user.id,
      voterKey: null,
      aiGenerated: true,
      aiPrompt: fullPrompt,
    });

    await recordAiGenerationSuccess(session.user.id);
    const usageAfter = await getAiUsageToday(session.user.id);

    return NextResponse.json({
      mediaShortId: media.shortId,
      storageKey: media.storageKey,
      prompt: fullPrompt,
      enhanceSource,
      imageProvider: gen.provider,
      usage: usageAfter,
      checkedAt: usageBefore,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    const status = msg.includes("Daily AI") ? 429 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
