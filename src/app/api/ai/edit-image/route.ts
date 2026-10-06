import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { editImageWithGemini } from "@/lib/ai/gemini-image-edit";
import { assertCanGenerateAi, getAiUsageToday, recordAiGenerationSuccess } from "@/lib/ai/usage";
import { prisma } from "@/lib/db";
import { processAndStoreUpload } from "@/lib/media-save";
import { readLocalObject } from "@/lib/storage";

const schema = z.object({
  mediaShortId: z.string().min(4),
  instruction: z.string().min(3).max(500),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    await assertCanGenerateAi(session.user.id, 1);
    const usageBefore = await getAiUsageToday(session.user.id);

    const media = await prisma.media.findUnique({
      where: { shortId: parsed.data.mediaShortId },
      include: { post: true },
    });
    if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ownerId = media.userId ?? media.post?.userId;
    if (ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!media.mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "Only images can be AI-edited" }, { status: 400 });
    }

    let sourceBuf = await readLocalObject(media.storageKey);
    if (!sourceBuf) {
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const res = await fetch(`${base}/api/media/${media.storageKey}?mime=${encodeURIComponent(media.mimeType)}`);
      if (!res.ok) throw new Error("Could not load source image");
      sourceBuf = Buffer.from(await res.arrayBuffer());
    }

    const edited = await editImageWithGemini({
      imageBuffer: sourceBuf,
      mimeType: media.mimeType,
      instruction: parsed.data.instruction,
    });

    const parentId = media.parentMediaId ?? media.id;
    const created = await processAndStoreUpload({
      buffer: edited.buffer,
      mime: edited.mimeType,
      userId: session.user.id,
      voterKey: null,
      parentMediaId: parentId,
      postId: media.postId ?? undefined,
      sortOrder: media.sortOrder,
      aiEdited: true,
      aiPrompt: parsed.data.instruction,
      losslessPng: true,
    });

    await recordAiGenerationSuccess(session.user.id, 1);
    const usageAfter = await getAiUsageToday(session.user.id);

    return NextResponse.json({
      mediaShortId: created.shortId,
      storageKey: created.storageKey,
      model: edited.model,
      instruction: parsed.data.instruction,
      usage: usageAfter,
      checkedAt: usageBefore,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI edit failed";
    const status = msg.includes("Daily AI") ? 429 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
