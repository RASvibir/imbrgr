import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { defaultShareMetadata } from "@/lib/og";
import { siteUrl } from "@/lib/urls";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { username: true, displayName: true, bio: true, avatarKey: true },
  });
  if (!user) return { title: "Not found" };
  const title = user.displayName ? `${user.displayName} (@${user.username})` : `@${user.username}`;
  const description = user.bio?.slice(0, 200) || `Cook profile on imbrgr — @${user.username}`;
  return {
    title,
    description,
    openGraph: {
      type: "profile",
      url: siteUrl(`/u/${user.username}`),
      title,
      description,
      ...defaultShareMetadata().openGraph,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
