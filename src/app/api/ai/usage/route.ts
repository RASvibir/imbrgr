import { NextResponse } from "next/server";
import { getAiUsageToday, getAnonymousAiUsageToday } from "@/lib/ai/usage";
import { getActor } from "@/lib/request-identity";

export async function GET(req: Request) {
  const actor = await getActor(req);
  if (actor.userId) {
    const usage = await getAiUsageToday(actor.userId);
    return NextResponse.json(usage);
  }
  const usage = await getAnonymousAiUsageToday(actor.ipHash);
  return NextResponse.json(usage);
}
