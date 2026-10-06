import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { enhancePrompt } from "@/lib/ai/prompt-enhance";

const schema = z.object({ prompt: z.string().min(3).max(500) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
  const result = await enhancePrompt(parsed.data.prompt);
  return NextResponse.json(result);
}
