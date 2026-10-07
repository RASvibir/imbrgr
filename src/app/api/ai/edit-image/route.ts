import { NextResponse } from "next/server";
import { z } from "zod";
import { aiMockEnabled, mockImageBuffer } from "@/lib/ai/mock";
import { resolveImageEdit } from "@/lib/ai/resolve-image-edit";
import {
  assertCanGenerateAiForAnonymous,
  assertCanGenerateAiForUser,
  recordAiGenerationSuccess,
  recordAnonymousAiSuccess,
} from "@/lib/ai/usage";
import { aiRateLimitPerHour } from "@/lib/config";
import { prisma } from "@/lib/db";
import { isMediaOwner } from "@/lib/media-access";
import { processAndStoreUpload } from "@/lib/media-save";
import { getActor } from "@/lib/request-identity";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readLocalObject, readObject } from "@/lib/storage";
import { blockedPromptMessage, isPromptBlocked } from "@/lib/prompt-safety";
import { friendlyError } from "@/lib/user-messages";
import { normalizeVisibility } from "@/lib/visibility";

const schema = z.object({
  mediaShortId: z.string().min(4),
  instruction: z.string().min(3).max(500),
});

async function loadMediaBytes(storageKey: string): Promise<Buffer | null> {
  return (await readObject(storageKey)) ?? (await readLocalObject(storageKey));
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: friendlyError("Invalid request") }, { status: 400 });
  if (isPromptBlocked(parsed.data.instruction)) {
    return NextResponse.json({ error: blockedPromptMessage }, { status: 400 });
  }

  try {
    await consumeRateLimit(`ai:${actor.userId ?? actor.ipHash}`, aiRateLimitPerHour(), 60 * 60 * 1000);
    if (actor.userId) await assertCanGenerateAiForUser(actor.userId, 1);
    else await assertCanGenerateAiForAnonymous(actor.ipHash, 1);

    const media = await prisma.media.findUnique({
      where: { shortId: parsed.data.mediaShortId },
      include: { post: true },
    });
    if (!media) return NextResponse.json({ error: friendlyError("Not found") }, { status: 404 });
    if (!isMediaOwner(media, actor)) {
      return NextResponse.json({ error: friendlyError("Forbidden") }, { status: 403 });
    }
    if (!media.mimeType.startsWith("image/")) {
      return NextResponse.json({ error: friendlyError("Only images can be edited") }, { status: 400 });
    }

    const sourceBuf = await loadMediaBytes(media.storageKey);
    if (!sourceBuf) {
      return NextResponse.json({ error: friendlyError("Could not load source image") }, { status: 400 });
    }

    let out: Buffer;
    let outMime = "image/png";
    if (aiMockEnabled()) {
      out = await mockImageBuffer();
    } else {
      const edited = await resolveImageEdit({
        imageBuffer: sourceBuf,
        mimeType: media.mimeType,
        instruction: parsed.data.instruction,
      });
      out = edited.buffer;
      outMime = edited.mimeType;
    }

    const parentId = media.parentMediaId ?? media.id;
    const created = await processAndStoreUpload({
      buffer: out,
      mime: outMime.startsWith("image/") ? outMime : "image/png",
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

    if (media.postId) {
      await prisma.media.update({
        where: { id: media.id },
        data: { postId: null },
      });
    }

    if (actor.userId) await recordAiGenerationSuccess(actor.userId, 1);
    else await recordAnonymousAiSuccess(actor.ipHash, 1);

    return NextResponse.json({
      mediaShortId: created.shortId,
      storageKey: created.storageKey,
      mimeType: created.mimeType,
      deleteToken: created.deleteToken,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "AI edit failed";
    const status = raw.includes("resting") || raw.includes("plating") ? 429 : 400;
    return NextResponse.json({ error: friendlyError(raw) }, { status });
  }
}
