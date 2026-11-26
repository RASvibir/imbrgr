import sharp from "sharp";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { recordAiGenerationSuccess, recordAnonymousAiSuccess } from "@/lib/ai/usage";
import { resolveVideoDimensions } from "@/lib/ai/video-provider";
import { newStorageKey, putObject } from "@/lib/storage";
import { friendlyError } from "@/lib/user-messages";
import { gpuTimeoutMs } from "@/lib/ai/gpu/client";
import { checkGpuDailyCap } from "@/lib/ai/gpu/cap";
import { assembledBackend, NOT_FRAME_CHAINED_LABEL, selectBackend, type ShotBackend } from "./backend";
import type { JobInput, JobShot, JobStatus, JobView, LastFrameSource } from "./types";

export const MAX_LAST_FRAME_BYTES = 5 * 1024 * 1024;
export const MAX_LAST_FRAME_PIXELS = 16_000_000;
export const ALLOWED_LAST_FRAME_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

type JobRow = {
  id: string;
  ownerKey: string;
  userId: string | null;
  ipHash: string | null;
  status: string;
  input: unknown;
  shots: unknown;
  nextShot: number;
  error: string | null;
};

export type JobActor = { userId: string | null; ipHash: string };

export function ownerKeyFor(actor: JobActor): string {
  return actor.userId ? `u:${actor.userId}` : `ip:${actor.ipHash}`;
}

function publicShot(shot: JobShot): JobShot {
  const copy = { ...shot };
  delete copy.remoteId;
  delete copy.startedAt;
  delete copy.lastFrame;
  delete copy.lastFrameSource;
  delete copy.seedImage;
  delete copy.seedImageSource;
  delete copy.gpuRequestId;
  delete copy.fallbackReason;
  delete copy.frameChained;
  delete copy.continuationFallback;
  return copy;
}

export function serializeJob(job: JobRow, opts: { images: boolean }): JobView {
  const input = job.input as JobInput;
  const shots = job.shots as JobShot[];
  const status = job.status as JobStatus;
  const isSignedInOwner = Boolean(job.userId);
  const finalShot = shots[shots.length - 1];
  const latestDone = job.nextShot > 0 ? shots[job.nextShot - 1] : undefined;
  const captureTarget =
    isSignedInOwner &&
    opts.images &&
    !input.mature &&
    (status === "running" || status === "done") &&
    latestDone?.mediaType === "video" &&
    latestDone.videoUrl &&
    !latestDone.lastFrame
      ? { shotIndex: job.nextShot - 1, videoUrl: latestDone.videoUrl }
      : undefined;
  const continuationLabel =
    input.parentJobId && status === "done"
      ? (shots.find((s) => s.continuationFallback)?.continuationFallback ??
        (shots.some((s) => s.frameChained === false) ? NOT_FRAME_CHAINED_LABEL : undefined))
      : undefined;
  const canContinue =
    status === "done" &&
    !input.mature &&
    Boolean(finalShot) &&
    (isSignedInOwner ? Boolean(finalShot?.lastFrame) : true);
  return {
    id: job.id,
    status,
    mode: input.mode,
    durationSec: input.durationSec,
    mature: input.mature,
    total: shots.length,
    completed: job.nextShot,
    canContinue,
    promptUsed: input.prompt,
    promptSource: input.promptSource,
    ...(captureTarget ? { captureTarget } : {}),
    ...(continuationLabel ? { continuationLabel } : {}),
    error: job.error ?? undefined,
    shots:
      opts.images && status === "done"
        ? shots.map(publicShot)
        : undefined,
  };
}

export async function createVideoJob(actor: JobActor, input: JobInput, shots: JobShot[]) {
  return prisma.videoJob.create({
    data: {
      ownerKey: ownerKeyFor(actor),
      userId: actor.userId,
      ipHash: actor.userId ? null : actor.ipHash,
      status: "queued",
      input: input as unknown as Prisma.InputJsonValue,
      shots: shots as unknown as Prisma.InputJsonValue,
      nextShot: 0,
    },
  });
}

export async function getVideoJob(id: string, actor: JobActor) {
  const job = await prisma.videoJob.findUnique({ where: { id } });
  if (!job || job.ownerKey !== ownerKeyFor(actor)) return null;
  return job;
}

export type ContinuationResult =
  | { ok: true; lastFrame?: string; lastFrameSource?: LastFrameSource; promptOnly?: boolean }
  | { ok: false; status: 404 | 409; error: string };

/** Finds the last frame of a finished clip the actor owns, so a new job can start from it. */
export async function resolveContinuation(parentJobId: string, actor: JobActor): Promise<ContinuationResult> {
  const parent = await getVideoJob(parentJobId, actor);
  if (!parent) return { ok: false, status: 404, error: "Video job not found" };
  if (parent.status !== "done") {
    return { ok: false, status: 409, error: "Wait for the clip to finish before continuing it." };
  }
  const input = parent.input as JobInput;
  if (input.mature) return { ok: false, status: 409, error: "This clip can't be continued." };
  // Guest continuations are prompt-only and never frame-chained.
  if (!actor.userId || !parent.userId) {
    return { ok: true, promptOnly: true };
  }
  const shots = parent.shots as JobShot[];
  const finalShot = shots[shots.length - 1];
  const lastFrame = finalShot?.lastFrame;
  if (!lastFrame) return { ok: false, status: 409, error: "This clip can't be continued." };
  return {
    ok: true,
    lastFrame,
    ...(finalShot.lastFrameSource ? { lastFrameSource: finalShot.lastFrameSource } : {}),
  };
}

const OPEN: JobStatus[] = ["queued", "running"];

/** Renders the next shot. Quota is recorded once, when the last shot lands; a failed job costs nothing. */
export async function stepVideoJob(
  id: string,
  actor: JobActor,
  backendOverride?: ShotBackend,
): Promise<JobRow | null> {
  const job = await getVideoJob(id, actor);
  if (!job) return null;
  if (!OPEN.includes(job.status as JobStatus)) return job;

  const input = job.input as JobInput;
  const backend = backendOverride ?? (input.mature ? assembledBackend : selectBackend());
  const shots = job.shots as JobShot[];
  const index = job.nextShot;
  const shot = shots[index];
  if (!shot) return job;

  const { width, height } = resolveVideoDimensions(input.aspectRatio);
  const guard = { id, nextShot: index, status: { in: OPEN } };
  const renderParams = {
    prompt: shot.visualPrompt,
    stockQuery: shot.stockQuery,
    durationSec: shot.durationSec,
    aspectRatio: input.aspectRatio,
    style: input.style,
    width,
    height,
    // Stills share one seed so keyframes keep a similar look; chained GPU clips vary it per clip.
    seed: backend.advanceShot ? input.seed + index : input.seed,
    mature: input.mature,
  };

  const commit = async (patch: Partial<JobShot>) => {
    const updated = shots.map((s, i) => (i === index ? { ...s, ...patch } : s));
    const last = index === shots.length - 1;
    const claimed = await prisma.videoJob.updateMany({
      where: guard,
      data: {
        shots: updated as unknown as Prisma.InputJsonValue,
        nextShot: index + 1,
        status: last ? "done" : "running",
      },
    });
    if (claimed.count === 1 && last) {
      try {
        if (job.userId) await recordAiGenerationSuccess(job.userId, 1);
        else if (job.ipHash) await recordAnonymousAiSuccess(job.ipHash, 1);
      } catch (err) {
        console.error("[imbrgr/ai-video] quota record failed", err);
      }
    }
  };

  const prevShot = index > 0 ? shots[index - 1] : undefined;
  const rawSeedImage = index > 0 ? prevShot?.lastFrame : shot.seedImage;
  const rawSeedSource = index > 0 ? prevShot?.lastFrameSource : shot.seedImageSource;
  const allowSeed =
    Boolean(rawSeedImage) &&
    !input.mature &&
    (rawSeedSource !== "client" || Boolean(job.userId));
  const seedImage = allowSeed ? rawSeedImage : undefined;
  const seedImageSource = allowSeed ? rawSeedSource : undefined;
  // Only a continuation job is a continuation; later shots of a normal job still chain via seedImage.
  const isContinuation = Boolean(input.parentJobId);
  // Only the first shot of a continuation job is seeded from the parent clip's last frame.
  const seedFromParent = index === 0 && isContinuation && Boolean(seedImage);

  const stillsPatch = async (renderer: ShotBackend, seed: number): Promise<Partial<JobShot>> => {
    const shotResult = await renderer.renderShot({
      ...renderParams,
      seed,
      ...(seedImage ? { seedImage } : {}),
      ...(seedImageSource ? { seedImageSource } : {}),
      ...(isContinuation ? { isContinuation, continueMode: input.continueMode } : {}),
      ...(seedFromParent ? { seedFromParent } : {}),
    });
    return typeof shotResult === "string"
      ? { imageUrl: shotResult, mediaType: "image" as const, backend: "assembled" as const }
      : {
          imageUrl: shotResult.imageUrl,
          videoUrl: shotResult.videoUrl,
          mediaType: shotResult.mediaType || (shotResult.videoUrl ? ("video" as const) : ("image" as const)),
          sourceDurationSec: shotResult.sourceDurationSec,
          creditName: shotResult.creditName,
          creditUrl: shotResult.creditUrl,
          ...(shotResult.lastFrame
            ? {
                lastFrame: shotResult.lastFrame,
                lastFrameSource: shotResult.lastFrameSource ?? ("server" as const),
              }
            : {}),
          ...(shotResult.frameChained !== undefined ? { frameChained: shotResult.frameChained } : {}),
          ...(shotResult.continuationFallback ? { continuationFallback: shotResult.continuationFallback } : {}),
          backend: "assembled" as const,
        };
  };

  try {
    if (backend.advanceShot) {
      const startedAt = shot.startedAt ?? Date.now();
      if (Date.now() - startedAt > gpuTimeoutMs()) throw new Error("gpu_generation_timeout");
      if (!shot.remoteId) await checkGpuDailyCap();
      const advance = await backend.advanceShot({
        ...renderParams,
        remoteId: shot.remoteId,
        initImage: seedImage,
      });
      if (advance.state === "pending") {
        const waiting = shots.map((s, i) => (i === index ? { ...s, remoteId: advance.remoteId, startedAt } : s));
        await prisma.videoJob.updateMany({
          where: guard,
          data: { shots: waiting as unknown as Prisma.InputJsonValue, status: "running" },
        });
        return prisma.videoJob.findUnique({ where: { id } });
      }
      await commit({
        imageUrl: advance.result.imageUrl,
        videoUrl: advance.result.videoUrl,
        mediaType: advance.result.mediaType,
        lastFrame: advance.lastFrame,
        ...(advance.lastFrame ? { lastFrameSource: "server" as const } : {}),
        backend: "gpu",
        gpuRequestId: shot.remoteId,
        remoteId: undefined,
        startedAt: undefined,
      });
    } else {
      await commit(await stillsPatch(backend, renderParams.seed));
    }
  } catch (err) {
    const capEvent = err instanceof Error && (err.message === "gpu_daily_cap" || err.message === "gpu_cap_check_failed");
    (capEvent ? console.warn : console.error)("[imbrgr/ai-video] shot render failed", { jobId: id, shot: index, backend: backend.name }, err);
    const reason = err instanceof Error ? err.message : "unknown";
    let recovered = false;
    if (backend.advanceShot && !input.mature) {
      try {
        const patch = await stillsPatch(assembledBackend, input.seed);
        await commit({
          ...patch,
          fallbackReason: reason,
          gpuRequestId: shot.remoteId,
          remoteId: undefined,
          startedAt: undefined,
        });
        recovered = true;
      } catch (fallbackErr) {
        console.error("[imbrgr/ai-video] assembled fallback failed", { jobId: id, shot: index }, fallbackErr);
      }
    }
    if (!recovered) {
      await prisma.videoJob.updateMany({
        where: guard,
        data: {
          status: "failed",
          error: friendlyError(reason === "unknown" ? "Video generation failed" : reason),
        },
      });
    }
  }

  return prisma.videoJob.findUnique({ where: { id } });
}

export type AttachLastFrameResult =
  | { ok: true; job: JobRow }
  | { ok: false; status: 400 | 401 | 404 | 409; error: string };

/**
 * Validates and stores a client-extracted final frame for a completed video shot so
 * subsequent shots or continuation jobs can chain from it without passing raw data URLs.
 */
export async function attachShotLastFrame(params: {
  jobId: string;
  actor: JobActor;
  shotIndex?: number;
  buffer: Buffer;
  mime: string;
}): Promise<AttachLastFrameResult> {
  if (!params.actor.userId) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const job = await getVideoJob(params.jobId, params.actor);
  if (!job) return { ok: false, status: 404, error: "Video job not found" };
  if (!job.userId) {
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const input = job.input as JobInput;
  if (input.mature) {
    return { ok: false, status: 409, error: "Mature clips can't be continued." };
  }
  if (job.status !== "done" && job.status !== "running") {
    return { ok: false, status: 409, error: "Job is not ready for frame capture." };
  }

  const shots = job.shots as JobShot[];
  const idx = params.shotIndex ?? job.nextShot - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= job.nextShot || idx >= shots.length) {
    return { ok: false, status: 400, error: "Invalid shot index." };
  }
  if (!ALLOWED_LAST_FRAME_MIME.has(params.mime)) {
    return { ok: false, status: 400, error: "Unsupported frame image type." };
  }
  if (params.buffer.byteLength === 0 || params.buffer.byteLength > MAX_LAST_FRAME_BYTES) {
    return { ok: false, status: 400, error: "Frame image exceeds size limit." };
  }

  let out: Buffer;
  try {
    // Strip all EXIF/IPTC/XMP metadata by omitting withMetadata(), while keeping auto-rotation and a pixel cap.
    out = await sharp(params.buffer, { limitInputPixels: MAX_LAST_FRAME_PIXELS })
      .rotate()
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    return { ok: false, status: 400, error: "Invalid frame image data." };
  }

  const stored = await putObject(newStorageKey("jpg"), out, "image/jpeg");
  const updatedShots = shots.map((s, i) =>
    i === idx ? { ...s, lastFrame: stored.url, lastFrameSource: "client" as const } : s,
  );
  // Guarded like commit(): if a step advanced the job since we read it, don't overwrite its shots.
  const claimed = await prisma.videoJob.updateMany({
    where: { id: job.id, nextShot: job.nextShot },
    data: { shots: updatedShots as unknown as Prisma.InputJsonValue },
  });
  if (claimed.count !== 1) {
    return { ok: false, status: 409, error: "Job advanced while capturing the frame; retry." };
  }
  const updated = { ...job, shots: updatedShots as unknown as JobRow["shots"] };
  console.info("[imbrgr/ai-video] last-frame uploaded", {
    jobId: job.id,
    userId: params.actor.userId,
    byteSize: out.byteLength,
  });
  return { ok: true, job: updated };
}
