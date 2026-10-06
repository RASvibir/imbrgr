import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAnonymousStorage, getUserStorage } from "@/lib/storage-quota";
import { getVoterKey } from "@/lib/voter";

export async function GET() {
  const session = await auth();
  if (session?.user) {
    const s = await getUserStorage(session.user.id);
    return NextResponse.json({
      type: "user",
      used: s.used.toString(),
      quota: s.quota,
      remaining: s.remaining.toString(),
    });
  }
  const { voterKey } = await getVoterKey();
  const s = await getAnonymousStorage(voterKey);
  return NextResponse.json({
    type: "anonymous",
    used: s.used.toString(),
    quota: s.quota,
    remaining: s.remaining.toString(),
  });
}
