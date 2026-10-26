import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { recordAiGenerationSuccess, recordAnonymousAiSuccess } from "@/lib/ai/usage";
import { resolveVideoDimensions } from "@/lib/ai/video-provider";
import { friendlyError } from "@/lib/user-messages";
import { selectBackend, type ShotBackend } from "./backend";
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

export function serializeJob(job: JobRow, opts: { images: boolean }): JobView {
  const input = job.input as JobInput;
  const shots = job.shots as JobShot[];
  const status = job.status as JobStatus;
  return {
    id: job.id,
    status,
    mode: input.mode,
    durationSec: input.durationSec,
    mature: input.mature,
    total: shots.length,
    completed: job.nextShot,
    error: job.error ?? undefined,
    shots: opts.images && status === "done" ? shots : undefined,
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

const OPEN: JobStatus[] = ["queued", "running"];

/** Renders the next shot. Quota is recorded once, when the last shot lands; a failed job costs nothing. */
export async function stepVideoJob(
  id: string,
  actor: JobActor,
  backend: ShotBackend = selectBackend(),
): Promise<JobRow | null> {
  const job = await getVideoJob(id, actor);
  if (!job) return null;
  if (!OPEN.includes(job.status as JobStatus)) return job;

  const input = job.input as JobInput;
  const shots = job.shots as JobShot[];
  const index = job.nextShot;
  const shot = shots[index];
  if (!shot) return job;

  const { width, height } = resolveVideoDimensions(input.aspectRatio);
  const guard = { id, nextShot: index, status: { in: OPEN } };

  try {
    const shotResult = await backend.renderShot({
      prompt: shot.visualPrompt,
      stockQuery: shot.stockQuery,
      durationSec: shot.durationSec,
      aspectRatio: input.aspectRatio,
      style: input.style,
      width,
      height,
      seed: input.seed + index,
      mature: input.mature,
    });
    const patch =
      typeof shotResult === "string"
        ? { imageUrl: shotResult, mediaType: "image" as const }
        : {
            imageUrl: shotResult.imageUrl,
            videoUrl: shotResult.videoUrl,
            mediaType: shotResult.mediaType || (shotResult.videoUrl ? ("video" as const) : ("image" as const)),
          };
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
  } catch (err) {
    console.error("[imbrgr/ai-video] shot render failed", err);
    await prisma.videoJob.updateMany({
      where: guard,
      data: {
        status: "failed",
        error: friendlyError(err instanceof Error ? err.message : "Video generation failed"),
      },
    });
  }

  return prisma.videoJob.findUnique({ where: { id } });
}
