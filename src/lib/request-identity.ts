import { createHash } from "node:crypto";
import { auth } from "@/lib/auth";
import { getVoterKey } from "@/lib/voter";

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function hashIp(ip: string): string {
  const secret = process.env.AUTH_SECRET ?? "dev";
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex");
}

export type Actor = {
  userId: string | null;
  voterKey: string;
  ipHash: string;
};

export async function getActor(req: Request): Promise<Actor> {
  const { userId, voterKey } = await getVoterKey();
  const ip = getClientIp(req);
  return { userId, voterKey, ipHash: hashIp(ip) };
}

export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** For server components (no Request). */
export async function getServerActor(): Promise<Actor> {
  const session = await auth();
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  let vid = jar.get("imbrgr_vid")?.value;
  if (!vid) vid = `a:${crypto.randomUUID()}`;
  const userId = session?.user?.id ?? null;
  const voterKey = userId ? `u:${userId}` : vid;
  return { userId, voterKey, ipHash: hashIp("server") };
}
