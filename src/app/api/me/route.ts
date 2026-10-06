import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const profileSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/i)
    .optional(),
  displayName: z.string().min(1).max(80).optional(),
  bio: z.string().max(2000).optional(),
  links: z
    .array(z.object({ label: z.string().max(40), url: z.string().url().max(500) }))
    .max(5)
    .optional(),
  favoritesPublic: z.boolean().optional(),
  defaultPostVisibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      bio: true,
      avatarKey: true,
      bannerKey: true,
      links: true,
      favoritesPublic: true,
      storageBytesUsed: true,
      defaultPostVisibility: true,
      createdAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...user,
    storageBytesUsed: user.storageBytesUsed.toString(),
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid profile" }, { status: 400 });

  if (parsed.data.username) {
    const taken = await prisma.user.findFirst({
      where: {
        username: parsed.data.username.toLowerCase(),
        NOT: { id: session.user.id },
      },
    });
    if (taken) return NextResponse.json({ error: "Username taken" }, { status: 409 });
  }

  const data = {
    ...parsed.data,
    username: parsed.data.username?.toLowerCase(),
  };

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
  });
  return NextResponse.json({
    ...user,
    storageBytesUsed: user.storageBytesUsed.toString(),
  });
}
