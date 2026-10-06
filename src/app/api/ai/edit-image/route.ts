import { NextResponse } from "next/server";
import { z } from "zod";
import { editImageWithGemini } from "@/lib/ai/gemini-image-edit";
import { aiMockEnabled, mockImageBuffer } from "@/lib/ai/mock";
import {
  assertCanGenerateAiForAnonymous,
  assertCanGenerateAiForUser,
  getAiUsageToday,
  getAnonymousAiUsageToday,
  recordAiGenerationSuccess,
  recordAnonymousAiSuccess,
} from "@/lib/ai/usage";
import { aiRateLimitPerHour } from "@/lib/config";
import { prisma } from "@/lib/db";
import { isMediaOwner } from "@/lib/media-access";
import { processAndStoreUpload } from "@/lib/media-save";
import { getActor } from "@/lib/request-identity";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readObject } from "@/lib/storage";
import { normalizeVisibility } from "@/lib/visibility";

const schema = z.object({
  mediaShortId: z.string().min(4),
  instruction: z.string().min(3).max(500),
});

export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    await consumeRateLimit(`ai:${actor.userId ?? actor.ipHash}`, aiRateLimitPerHour(), 60 * 60 * 1000);
    if (actor.userId) await assertCanGenerateAiForUser(actor.userId, 1);
    else await assertCanGenerateAiForAnonymous(actor.ipHash, 1);

    const usageBefore = actor.userId
      ? await getAiUsageToday(actor.userId)
      : await getAnonymousAiUsageToday(actor.ipHash);

    const media = await prisma.media.findUnique({
      where: { shortId: parsed.data.mediaShortId },
      include: { post: true },
    });
    if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!isMediaOwner(media, actor)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!media.mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "Only images can be AI-edited" }, { status: 400 });
    }

    const sourceBuf = await readObject(media.storageKey);
    if (!sourceBuf) {
      return NextResponse.json({ error: "Could not load source image" }, { status: 400 });
    }

    let out: Buffer;
    if (aiMockEnabled()) {
      out = await mockImageBuffer();
    } else {
      const edited = await editImageWithGemini({
        imageBuffer: sourceBuf,
        mimeType: media.mimeType,
        instruction: parsed.data.instruction,
      });
      out = edited.buffer;
    }

    const parentId = media.parentMediaId ?? media.id;
    const created = await processAndStoreUpload({
      buffer: out,
      mime: "image/png",
      userId: actor.userId,
      voterKey: actor.userId ? null : actor.voterKey,
      parentMediaId: parentId,
      postId: media.postId ?? undefined,
      sortOrder: media.sortOrder,
      aiEdited: true,
      aiPrompt: parsed.data.instruction,
      losslessPng: true,
      visibility: normalizeVisibility(media.visibility),
    });

    if (actor.userId) await recordAiGenerationSuccess(actor.userId, 1);
    else await recordAnonymousAiSuccess(actor.ipHash, 1);

    const usageAfter = actor.userId
      ? await getAiUsageToday(actor.userId)
      : await getAnonymousAiUsageToday(actor.ipHash);

    return NextResponse.json({
      mediaShortId: created.shortId,
      storageKey: created.storageKey,
      deleteToken: created.deleteToken,
      instruction: parsed.data.instruction,
      usage: usageAfter,
      checkedAt: usageBefore,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI edit failed";
    const status = msg.includes("limit") || msg.includes("Too many") ? 429 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
