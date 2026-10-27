import { NextResponse } from "next/server";
import { getVideoJob, serializeJob } from "@/lib/ai/video-job/service";
import { getActor } from "@/lib/request-identity";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getActor(req);
  const job = await getVideoJob(id, actor);
  if (!job) return NextResponse.json({ error: "Video job not found" }, { status: 404 });
  return NextResponse.json({ success: true, job: serializeJob(job, { images: true }) });
}
