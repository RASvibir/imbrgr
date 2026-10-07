import { prisma } from "@/lib/db";
import { generateImageThumbnails } from "@/lib/thumbnails";
import { deleteObject, readLocalObject, readObject } from "@/lib/storage";

export type BackfillBatchResult = {
  processed: number;
  updated: number;
  skipped: { shortId: string; reason: string }[];
  failed: { shortId: string; reason: string }[];
};

const skipIds = new Set<string>();

export function assertSafeBackfillEnvironment() {
  const url = process.env.DATABASE_URL ?? "";
  const driver = process.env.STORAGE_DRIVER ?? "local";
  const looksRemote =
    /neon\.tech|supabase|amazonaws|vercel-storage|postgres\.railway|render\.com/i.test(url) ||
    (url.includes("@") && !/localhost|127\.0\.0\.1/.test(url));
  if (looksRemote && driver !== "blob") {
    throw new Error(
      "Refusing backfill: remote DATABASE_URL requires STORAGE_DRIVER=blob so thumbs land in object storage.",
    );
  }
}

export async function runThumbnailBackfillBatch(take = 50): Promise<BackfillBatchResult> {
  const batch = await prisma.media.findMany({
    where: {
      mimeType: { startsWith: "image/" },
      thumbMdKey: null,
      id: { notIn: [...skipIds] },
    },
    take,
    orderBy: { id: "asc" },
  });

  const result: BackfillBatchResult = { processed: batch.length, updated: 0, skipped: [], failed: [] };

  for (const m of batch) {
    const data = (await readObject(m.storageKey)) ?? (await readLocalObject(m.storageKey));
    if (!data) {
      skipIds.add(m.id);
      result.skipped.push({ shortId: m.shortId, reason: "missing_source" });
      continue;
    }
    try {
      if (m.thumbSmKey) await deleteObject(m.thumbSmKey).catch(() => {});
      if (m.thumbMdKey) await deleteObject(m.thumbMdKey).catch(() => {});
      const thumbs = await generateImageThumbnails(data);
      const applied = await prisma.media.updateMany({
        where: { id: m.id, thumbMdKey: null },
        data: {
          thumbSmKey: thumbs.thumbSmKey,
          thumbMdKey: thumbs.thumbMdKey,
          placeholderCss: thumbs.placeholderCss,
        },
      });
      if (applied.count === 0) {
        await deleteObject(thumbs.thumbSmKey).catch(() => {});
        await deleteObject(thumbs.thumbMdKey).catch(() => {});
      } else {
        result.updated++;
      }
    } catch (e) {
      result.failed.push({
        shortId: m.shortId,
        reason: e instanceof Error ? e.message : "generate_failed",
      });
    }
  }

  return result;
}
