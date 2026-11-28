import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isUserAgeVerified } from "@/lib/age-gate";
import { prisma } from "@/lib/db";
import { postCardSelect } from "@/lib/posts";

/** Age-gated creator share portal API — never exposed on public feeds or profiles. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ username: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in and verify your age (18+) to view uncensored shares.", code: "SIGN_IN_REQUIRED" },
      { status: 401 },
    );
  }

  const verified = await isUserAgeVerified(session.user.id);
  if (!verified) {
    return NextResponse.json(
      { error: "Age verification required (18+).", code: "AGE_VERIFICATION_REQUIRED" },
      { status: 403 },
    );
  }

  const { username } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = session.user.id === user.id;
  const posts = await prisma.post.findMany({
    where: {
      userId: user.id,
      hiddenByAdmin: false,
      visibility: isOwner ? { in: ["PUBLIC", "UNLISTED", "PRIVATE"] } : { in: ["PUBLIC", "UNLISTED"] },
      media: {
        some: {
          mature: true,
          OR: [{ mimeType: { startsWith: "image/" } }, { mimeType: { startsWith: "video/" } }],
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 48,
    select: postCardSelect,
  });

  return NextResponse.json({
    username: user.username,
    displayName: user.displayName,
    isOwner,
    posts,
  });
}
