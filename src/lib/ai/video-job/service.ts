import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { recordAiGenerationSuccess, recordAnonymousAiSuccess } from "@/lib/ai/usage";
import { resolveVideoDimensions } from "@/lib/ai/video-provider";
import { friendlyError } from "@/lib/user-messages";
import { gpuTimeoutMs } from "@/lib/ai/gpu/client";
import { assembledBackend, selectBackend, type ShotBackend } from "./backend";
import type { JobInput, JobShot, JobStatus, JobView } from "./types";

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
  delete copy.seedImage;
  delete copy.gpuRequestId;
  delete copy.fallbackReason;
  return copy;
}

export function serializeJob(job: JobRow, opts: { images: boolean }): JobView {
  const input = job.input as JobInput;
  const shots = job.shots as JobShot[];
  const status = job.status as JobStatus;
  const finalShot = shots[shots.length - 1];
  return {
    id: job.id,
    status,
    mode: input.mode,
    durationSec: input.durationSec,
    mature: input.mature,
    total: shots.length,
    completed: job.nextShot,
    canContinue: status === "done" && !input.mature && Boolean(finalShot?.lastFrame),
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
  | { ok: true; lastFrame: string }
  | { ok: false; status: 404 | 409; error: string };

/** Finds the last frame of a finished clip the actor owns, so a new job can start from it. */
export async function resolveContinuation(parentJobId: string, actor: JobActor): Promise<ContinuationResult> {
  const parent = await getVideoJob(parentJobId, actor);
  if (!parent) return { ok: false, status: 404, error: "Video job not found" };
  if (parent.status !== "done") {
    return { ok: false, status: 409, error: "Wait for the clip to finish before continuing it." };
  }
  const input = parent.input as JobInput;
  const shots = parent.shots as JobShot[];
  const lastFrame = shots[shots.length - 1]?.lastFrame;
  if (input.mature || !lastFrame) return { ok: false, status: 409, error: "This clip can't be continued." };
  return { ok: true, lastFrame };
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

  const stillsPatch = async (renderer: ShotBackend, seed: number): Promise<Partial<JobShot>> => {
    const shotResult = await renderer.renderShot({ ...renderParams, seed });
    return typeof shotResult === "string"
      ? { imageUrl: shotResult, mediaType: "image" as const, backend: "assembled" as const }
      : {
          imageUrl: shotResult.imageUrl,
          videoUrl: shotResult.videoUrl,
          mediaType: shotResult.mediaType || (shotResult.videoUrl ? ("video" as const) : ("image" as const)),
          sourceDurationSec: shotResult.sourceDurationSec,
          creditName: shotResult.creditName,
          creditUrl: shotResult.creditUrl,
          backend: "assembled" as const,
        };
  };

  try {
    if (backend.advanceShot) {
      const startedAt = shot.startedAt ?? Date.now();
      if (Date.now() - startedAt > gpuTimeoutMs()) throw new Error("gpu_generation_timeout");
      const advance = await backend.advanceShot({
        ...renderParams,
        remoteId: shot.remoteId,
        initImage: index > 0 ? shots[index - 1].lastFrame : shot.seedImage,
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
        backend: "gpu",
        gpuRequestId: shot.remoteId,
        remoteId: undefined,
        startedAt: undefined,
      });
    } else {
      await commit(await stillsPatch(backend, renderParams.seed));
    }
  } catch (err) {
    console.error("[imbrgr/ai-video] shot render failed", { jobId: id, shot: index, backend: backend.name }, err);
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
