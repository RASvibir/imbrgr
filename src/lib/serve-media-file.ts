import { isUserAgeVerified } from "@/lib/age-gate";
import { canViewMedia, canViewPost } from "@/lib/media-access";
import { contentTypeForKey } from "@/lib/media-types";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/request-identity";
import { parseRange } from "@/lib/http-range";
import { statObject, storageDriver } from "@/lib/storage";
import { mediaFilePath } from "@/lib/urls";
import { ownerKeyFor } from "@/lib/ai/video-job/service";
import type { JobShot } from "@/lib/ai/video-job/types";

type MediaRow = {
  visibility: string;
  mature?: boolean;
  post: { userId: string | null; visibility: string; hiddenByAdmin: boolean } | null;
};

const VIDEO_JOB_FILE_CACHE_TTL_MS = 60_000;
const MAX_VIDEO_JOB_FILE_CACHE = 512;
const videoJobFileCache = new Map<string, number>();

/** Clears the in-process VideoJob file ownership cache (used in tests). */
export function clearVideoJobFileCache(): void {
  videoJobFileCache.clear();
}

function getCachedVideoJobOwnership(cacheKey: string, now: number): boolean {
  const expiresAt = videoJobFileCache.get(cacheKey);
  if (expiresAt === undefined) return false;
  if (now >= expiresAt) {
    videoJobFileCache.delete(cacheKey);
    return false;
  }
  return true;
}

function setCachedVideoJobOwnership(cacheKey: string, now: number): void {
  if (videoJobFileCache.size >= MAX_VIDEO_JOB_FILE_CACHE) {
    const oldest = videoJobFileCache.keys().next().value;
    if (oldest !== undefined) videoJobFileCache.delete(oldest);
  }
  videoJobFileCache.set(cacheKey, now + VIDEO_JOB_FILE_CACHE_TTL_MS);
}

async function ownsVideoJobFile(storageKey: string, actor: Actor): Promise<boolean> {
  const ownerKey = ownerKeyFor(actor);
  const expectedPath = mediaFilePath(storageKey);
  const cacheKey = `${ownerKey}\0${expectedPath}`;
  const now = Date.now();
  if (getCachedVideoJobOwnership(cacheKey, now)) {
    return true;
  }

  const escaped = expectedPath.replace(/[\\%_]/g, "\\$&");
  const jobs = await prisma.$queryRaw<Array<{ shots: unknown }>>`
    SELECT "shots"
    FROM "VideoJob"
    WHERE "ownerKey" = ${ownerKey}
      AND "shots"::text LIKE ${`%${escaped}%`} ESCAPE '\'
    ORDER BY "createdAt" DESC
    LIMIT 10
  `;
  for (const job of jobs) {
    if (!Array.isArray(job.shots)) continue;
    for (const raw of job.shots) {
      const shot = raw as Partial<JobShot> | null;
      if (!shot) continue;
      for (const candidate of [shot.videoUrl, shot.imageUrl, shot.lastFrame, shot.seedImage]) {
        if (typeof candidate === "string" && candidate.split("?")[0] === expectedPath) {
          setCachedVideoJobOwnership(cacheKey, now);
          return true;
        }
      }
    }
  }
  return false;
}

export function mediaFileCacheControl(media: MediaRow | null, isProfileAsset: boolean): string {
  if (isProfileAsset) {
    return "public, max-age=86400";
  }
  if (!media) {
    return "private, no-store";
  }
  if (media.mature) {
    return "private, no-store";
  }
  const vis = media.post?.visibility ?? media.visibility;
  const isPrivate = vis === "PRIVATE" || Boolean(media.post?.hiddenByAdmin);
  if (isPrivate) {
    return "private, no-store";
  }
  // Gated route: visibility can change — do not pin with immutable public cache.
  return "public, max-age=300, must-revalidate";
}

export async function serveMediaFile(
  req: Request,
  storageKey: string,
  actor: Actor,
): Promise<Response> {
  if (storageDriver() === "blob" && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "[imbrgr/media] STORAGE_DRIVER=blob but BLOB_READ_WRITE_TOKEN is unset; files will 404",
    );
  }

  const media = await prisma.media.findFirst({
    where: {
      OR: [{ storageKey }, { thumbSmKey: storageKey }, { thumbMdKey: storageKey }],
    },
    include: { post: { select: { userId: true, visibility: true, hiddenByAdmin: true } } },
  });

  let isProfileAsset = false;
  if (!media) {
    const profileOwner = await prisma.user.findFirst({
      where: { OR: [{ avatarKey: storageKey }, { bannerKey: storageKey }] },
      select: { id: true },
    });
    if (profileOwner) {
      isProfileAsset = true;
    } else if (!(await ownsVideoJobFile(storageKey, actor))) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (media?.post && !canViewPost(media.post, actor)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (media && !canViewMedia(media, actor)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (media?.mature && !(await isUserAgeVerified(actor.userId))) {
    return Response.json(
      { error: "Age verification required", code: "AGE_VERIFICATION_REQUIRED" },
      { status: 403 },
    );
  }

  const object = await statObject(storageKey);
  if (!object) {
    if (storageDriver() === "blob") {
      console.error(`[imbrgr/media] blob read failed for key=${storageKey}`);
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const mimeHint = new URL(req.url).searchParams.get("mime") ?? undefined;
  const headers: Record<string, string> = {
    "Content-Type": contentTypeForKey(storageKey, mimeHint),
    "Cache-Control": mediaFileCacheControl(media, isProfileAsset),
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };

  const range = parseRange(req.headers.get("range"), object.size);
  if (range === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${object.size}` } });
  }

  const body = await object.open(range);
  if (!body) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (range) {
    return new Response(body, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${object.size}`,
        "Content-Length": String(range.end - range.start + 1),
      },
    });
  }
  return new Response(body, { status: 200, headers: { ...headers, "Content-Length": String(object.size) } });
}
