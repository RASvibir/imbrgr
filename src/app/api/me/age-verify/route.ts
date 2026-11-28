import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAtLeast18, parseBirthDate } from "@/lib/age-gate";
import { prisma } from "@/lib/db";

const verifySchema = z.object({
  birthDate: z.string().min(8).max(20),
  confirmAdult: z.literal(true),
});

/** Stores a signed-in user's birth date and 18+ attestation for uncensored share access. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid birth date and confirm you are 18 or older." },
      { status: 400 },
    );
  }

  const birthDate = parseBirthDate(parsed.data.birthDate);
  if (!birthDate) {
    return NextResponse.json({ error: "Invalid birth date format (YYYY-MM-DD)." }, { status: 400 });
  }

  if (!isAtLeast18(birthDate)) {
    return NextResponse.json(
      { error: "You must be at least 18 years old to unlock uncensored content." },
      { status: 403 },
    );
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      birthDate,
      adultVerifiedAt: now,
    },
  });

  return NextResponse.json({
    ageVerified: true,
    birthDate: birthDate.toISOString().slice(0, 10),
    adultVerifiedAt: now.toISOString(),
  });
}
