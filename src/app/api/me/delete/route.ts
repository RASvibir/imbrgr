import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { deleteUserAccount } from "@/lib/account-delete";

const bodySchema = z.object({
  deleteAllPosts: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await deleteUserAccount(session.user.id, {
    deleteAllPosts: parsed.data.deleteAllPosts,
  });
  return NextResponse.json({ ok: true });
}
