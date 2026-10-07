import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProfilePageClient } from "./ProfilePageClient";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { username: true },
  });
  if (!user) notFound();
  return <ProfilePageClient username={user.username} />;
}
