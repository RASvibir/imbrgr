import { NextResponse } from "next/server";
import { serializeJob, stepVideoJob } from "@/lib/ai/video-job/service";
import { getActor } from "@/lib/request-identity";

export const maxDuration = 60;

/** Renders the next shot of a job and returns its state. Safe to call repeatedly until done or failed. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getActor(req);
  const job = await stepVideoJob(id, actor);
  if (!job) return NextResponse.json({ error: "Video job not found" }, { status: 404 });
  return NextResponse.json({ success: true, job: serializeJob(job, { images: true }) });
}
