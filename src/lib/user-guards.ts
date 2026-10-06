import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/site-settings";

export async function assertUserMayUpload(userId: string | null): Promise<string | null> {
  if (!userId) {
    const settings = await getSiteSettings();
    if (!settings.anonymousUploadsEnabled) {
      return "Anonymous uploads are temporarily disabled.";
    }
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { banned: true, suspended: true },
  });
  if (!user) return "Account not found.";
  if (user.banned) return "This account is banned.";
  if (user.suspended) return "This account is suspended.";
  return null;
}

export async function assertUserMayUseAi(userId: string | null): Promise<string | null> {
  const uploadBlock = await assertUserMayUpload(userId);
  if (uploadBlock && userId) return uploadBlock;
  if (!userId) {
    const settings = await getSiteSettings();
    if (!settings.anonymousAiEnabled) {
      return "Guest AI is temporarily disabled.";
    }
  }
  return null;
}
