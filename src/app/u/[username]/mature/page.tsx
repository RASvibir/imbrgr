import type { Metadata } from "next";
import { MatureSharePortal } from "@/components/mature/MatureSharePortal";

export const metadata: Metadata = {
  title: "Uncensored Share (18+) | imbrgr",
  robots: { index: false, follow: false },
};

export default async function UserMaturePortalPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <MatureSharePortal username={username} />;
}
