import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { suggestAltText, suggestCaption, suggestTags } from "@/lib/ai/quick-suggest";

const schema = z.object({
  context: z.string().min(1).max(500),
  type: z.enum(["caption", "alt", "tags"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { context, type } = parsed.data;
  if (type === "caption") return NextResponse.json({ text: await suggestCaption(context) });
  if (type === "alt") return NextResponse.json({ text: await suggestAltText(context) });
  const tags = await suggestTags(context);
  return NextResponse.json({ tags });
}
